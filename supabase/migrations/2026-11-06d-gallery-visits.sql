-- 사진관 · 현장 방문 기록 (2026-11-06)
-- 보기: 누구나 / 올리기 · 수정 · 삭제: 운영진
-- 사진은 올릴 때 브라우저에서 줄이고(긴 변 1600px JPEG) 위치 정보(EXIF)를 지운 뒤 공개 저장소 'gallery'에 저장

create table if not exists public.visits (
  id          bigint generated always as identity primary key,
  visited_on  date not null,
  title       text not null check (char_length(btrim(title)) between 2 and 120),
  body        text not null default '' check (char_length(body) <= 5000),
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create table if not exists public.photos (
  id          bigint generated always as identity primary key,
  cat         text not null default '기타' check (cat in ('현장 방문', '공사 현장', '모델하우스', '행사', '기타')),
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  taken_on    date,
  path        text not null unique check (path ~ '^[0-9]{4}/[A-Za-z0-9._-]+\.(jpg|jpeg|webp|png)$'),
  width       int,
  height      int,
  visit_id    bigint references public.visits (id) on delete cascade,
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists photos_visit_idx on public.photos (visit_id);

create or replace function public.author_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_api_request() then return new; end if;
  if tg_op = 'INSERT' then new.created_by := auth.uid(); new.created_at := now();
  else new.created_by := old.created_by; new.created_at := old.created_at; end if;
  new.title := btrim(new.title);
  return new;
end $$;
drop trigger if exists visits_stamp on public.visits;
create trigger visits_stamp before insert or update on public.visits for each row execute function public.author_stamp();
drop trigger if exists photos_stamp on public.photos;
create trigger photos_stamp before insert or update on public.photos for each row execute function public.author_stamp();

alter table public.visits enable row level security;
alter table public.photos enable row level security;
revoke all on public.visits, public.photos from anon, authenticated;
grant select on public.visits, public.photos to anon, authenticated;
grant insert, update, delete on public.visits, public.photos to authenticated;
drop policy if exists visits_select on public.visits;
drop policy if exists visits_admin on public.visits;
drop policy if exists photos_select on public.photos;
drop policy if exists photos_admin on public.photos;
create policy visits_select on public.visits for select to anon, authenticated using (true);
create policy visits_admin  on public.visits for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy photos_select on public.photos for select to anon, authenticated using (true);
create policy photos_admin  on public.photos for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 공개 저장소: 누구나 보기, 운영진만 올리기 · 지우기
insert into storage.buckets (id, name, public) values ('gallery', 'gallery', true)
on conflict (id) do update set public = true;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit') then
    execute $q$update storage.buckets set file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/webp', 'image/png'] where id = 'gallery'$q$;
  end if;
end $$;
drop policy if exists gallery_admin_insert on storage.objects;
drop policy if exists gallery_admin_delete on storage.objects;
drop policy if exists gallery_admin_select on storage.objects;
create policy gallery_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'gallery' and public.is_admin());
create policy gallery_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'gallery' and public.is_admin());
create policy gallery_admin_select on storage.objects for select to authenticated using (bucket_id = 'gallery' and public.is_admin());

-- 사진 기록이 지워지면(방문 기록 삭제 포함) 파일을 지울 목록에 올림 → 알림 작업(30분마다)이 저장소에서 삭제
create or replace function public.photos_queue_file() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.file_cleanup (bucket, path) values ('gallery', old.path) on conflict do nothing;
  return null;
end $$;
drop trigger if exists photos_queue_file on public.photos;
create trigger photos_queue_file after delete on public.photos for each row execute function public.photos_queue_file();
grant select (path) on public.photos to service_role;

notify pgrst, 'reload schema';

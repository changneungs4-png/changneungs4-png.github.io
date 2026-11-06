-- 위임장 서명 · 연락처(선택) · 서면 접수 (2026-11-06)
-- 온라인: 계약자 성명 + 화면 서명(필수), 연락처(선택 동의). 서버가 일시와 문서 해시를 기록
-- 서면: 공식 메일로 받은 위임장을 운영진이 스캔본과 함께 등록 (계정 없는 세대도 집계)
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.agreements alter column user_id drop not null;
alter table public.agreements add column if not exists signature     text;
alter table public.agreements add column if not exists phone         text;
alter table public.agreements add column if not exists agree_contact boolean not null default false;
alter table public.agreements add column if not exists source        text not null default 'online';
alter table public.agreements add column if not exists paper_path    text;
alter table public.agreements add column if not exists entered_by    uuid;
alter table public.agreements add column if not exists doc_hash      text;

alter table public.agreements drop constraint if exists agreements_source_chk;
alter table public.agreements add constraint agreements_source_chk check (source in ('online', 'paper'));
alter table public.agreements drop constraint if exists agreements_signature_chk;
alter table public.agreements add constraint agreements_signature_chk
  check (signature is null or (signature like 'data:image/png;base64,%' and char_length(signature) between 200 and 300000));
alter table public.agreements drop constraint if exists agreements_phone_chk;
alter table public.agreements add constraint agreements_phone_chk
  check (phone is null or (agree_contact and phone ~ '^01[016789]-?[0-9]{3,4}-?[0-9]{4}$'));
alter table public.agreements drop constraint if exists agreements_kind_chk;
alter table public.agreements add constraint agreements_kind_chk check (
  (source = 'online' and user_id is not null)
  or (source = 'paper' and user_id is null and paper_path is not null and signer_name is not null)
) not valid;

create or replace function public.agreements_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare pp text;
begin
  if not public.is_api_request() then return new; end if;
  new.signed_at := coalesce(case when new.source = 'paper' then new.signed_at end, now());
  if new.source = 'paper' then
    -- 서면 위임장: 운영진만 등록
    if not public.is_admin() then raise exception '서면 위임장은 운영진만 등록할 수 있습니다' using errcode = '42501'; end if;
    if not exists (select 1 from public.units where id = new.unit_id) then raise exception '없는 세대입니다' using errcode = '22023'; end if;
    new.user_id := null; new.signature := null; new.entered_by := auth.uid();
    new.signer_name := btrim(new.signer_name);
    if new.signer_name is null or char_length(new.signer_name) not between 2 and 30 then raise exception '서면 위임장의 계약자 성명을 입력하세요' using errcode = '22023'; end if;
    if new.paper_path is null then raise exception '서면 위임장 스캔본을 첨부하세요' using errcode = '22023'; end if;
  else
    if public.my_claimed_unit() is null then raise exception '가입한 회원만 위임동의서를 낼 수 있습니다' using errcode = '42501'; end if;
    new.source := 'online';
    new.unit_id := public.my_claimed_unit();
    new.user_id := auth.uid(); new.entered_by := auth.uid(); new.paper_path := null;
    new.signer_name := btrim(new.signer_name);
    if new.signer_name is null or char_length(new.signer_name) not between 2 and 30 then raise exception '계약자 성명을 입력하세요' using errcode = '22023'; end if;
    if new.signature is null then raise exception '위임장에 서명해 주세요' using errcode = '22023'; end if;
    -- 이 세대의 서면 위임장이 먼저 있으면, 그 스캔본을 이어받고 온라인 위임으로 바꿈
    select a.paper_path into pp from public.agreements a where a.unit_id = new.unit_id and a.source = 'paper';
    if found then delete from public.agreements a where a.unit_id = new.unit_id and a.source = 'paper'; new.paper_path := pp; end if;
  end if;
  if not new.agree_contact then new.phone := null; end if;
  new.phone := nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'), '');
  if new.phone is not null then new.phone := regexp_replace(new.phone, '^(01[016789])([0-9]{3,4})([0-9]{4})$', '\1-\2-\3'); end if;
  -- 위임장 문서 지문: 양식 · 세대 · 성명 · 일시 · 동의 항목 · 서명(또는 스캔본)을 묶은 SHA-256
  new.doc_hash := encode(digest(concat_ws('|', new.form_version, new.unit_id, new.signer_name,
      to_char(new.signed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      new.agree_delegation::text, new.agree_privacy::text, new.agree_identity::text, new.agree_third_party::text, new.agree_contact::text,
      coalesce(new.phone, ''), coalesce(encode(digest(new.signature, 'sha256'), 'hex'), new.paper_path, '')), 'sha256'), 'hex');
  return new;
end $$;

-- 현황 집계: 승인된 회원의 온라인 위임 + 운영진이 등록한 서면 위임
create or replace function public.agreement_stats()
returns table (dong int, total int, agreed int)
language sql stable security definer set search_path = public as $$
  select u.dong, count(*)::int, count(a.unit_id) filter (where a.source = 'paper' or p.id is not null)::int
  from public.units u
  left join public.agreements a on a.unit_id = u.id
  left join public.profiles p on p.id = a.user_id and p.status = 'approved'
  group by u.dong order by u.dong;
$$;
create or replace function public.agreed_units()
returns setof text
language sql stable security definer set search_path = public as $$
  select a.unit_id from public.agreements a left join public.profiles p on p.id = a.user_id and p.status = 'approved'
  where (a.source = 'paper' or p.id is not null) and (public.is_member() or public.is_admin());
$$;

-- 서면 위임장 스캔본: 비공개, 운영진만
insert into storage.buckets (id, name, public) values ('consents', 'consents', false)
on conflict (id) do update set public = false;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit') then
    execute $q$update storage.buckets set file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] where id = 'consents'$q$;
  end if;
end $$;
drop policy if exists consents_admin_select on storage.objects;
drop policy if exists consents_admin_insert on storage.objects;
drop policy if exists consents_admin_delete on storage.objects;
create policy consents_admin_select on storage.objects for select to authenticated using (bucket_id = 'consents' and public.is_admin());
create policy consents_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'consents' and public.is_admin());
create policy consents_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'consents' and public.is_admin());

-- 위임이 지워지면(철회 · 계정 삭제 · 승인 취소) 서면 스캔본을 지울 목록에 올림 → 알림 작업(30분마다)이 저장소에서 삭제
create table if not exists public.file_cleanup (
  bucket text not null, path text not null, queued_at timestamptz not null default now(),
  primary key (bucket, path)
);
alter table public.file_cleanup enable row level security;
revoke all on public.file_cleanup from anon, authenticated;
grant select, delete on public.file_cleanup to service_role;
grant select (paper_path) on public.agreements to service_role;   -- 정리할 때 아직 쓰는 파일인지 확인
create or replace function public.agreements_queue_file() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.paper_path is not null and not exists (select 1 from public.agreements a where a.paper_path = old.paper_path) then
    insert into public.file_cleanup (bucket, path) values ('consents', old.paper_path) on conflict do nothing;
  end if;
  return null;
end $$;
drop trigger if exists agreements_queue_file on public.agreements;
create trigger agreements_queue_file after delete on public.agreements for each row execute function public.agreements_queue_file();

notify pgrst, 'reload schema';

-- 2026-11-13
-- 1) 내 아파트 선택 저장: 회원 본인만 읽고 쓰는 1계정 1행. 다른 기기에서 로그인해도 불러온다.
-- 2) 416동 동·호 배치 바로잡기: 분양 팸플릿 동·호배치도 기준 59A 라인은 18층, 59C 라인은 24층까지
--    (기존 표에 19층 · 25층이 하나씩 더 들어가 총 1,028세대였음 → 1,024세대).
--    이미 누가 쓰고 있는 세대(가입 등)는 지우지 않고 알림만 남긴다.

create table if not exists public.my_options (
  user_id     uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  data        jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 4000),
  updated_at  timestamptz not null default now()
);
alter table public.my_options enable row level security;
drop policy if exists my_options_select on public.my_options;
drop policy if exists my_options_insert on public.my_options;
drop policy if exists my_options_update on public.my_options;
drop policy if exists my_options_delete on public.my_options;
create policy my_options_select on public.my_options for select to authenticated using (user_id = auth.uid());
create policy my_options_insert on public.my_options for insert to authenticated with check (user_id = auth.uid());
create policy my_options_update on public.my_options for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy my_options_delete on public.my_options for delete to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on public.my_options to authenticated;

create or replace function public.my_options_stamp() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists my_options_stamp on public.my_options;
create trigger my_options_stamp before insert or update on public.my_options for each row execute function public.my_options_stamp();

do $$
declare u text;
begin
  foreach u in array array['416-1901', '416-1902', '416-2503', '416-2504'] loop
    begin
      delete from public.units where id = u;
    exception when foreign_key_violation then
      raise notice '% 세대는 이미 사용 중이라 지우지 않았습니다. 운영진이 확인하세요.', u;
    end;
  end loop;
end $$;
notify pgrst, 'reload schema';

-- 확인: 1024 이어야 함
select count(*) as 세대수 from public.units;

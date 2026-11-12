-- 카페 등업 (2026-11-12)
-- 카페는 소통, 계약자 확인은 홈페이지. 승인 회원이 카페 닉네임을 남기면 운영진이 이 목록을 보고 등업한다.
-- 계약서 사진을 카페에서 다시 받지 않는다. 전화번호는 여기서 다루지 않는다(위임장에서만).

alter table public.profiles add column if not exists cafe_nick text;
alter table public.profiles drop constraint if exists profiles_cafe_nick_chk;
alter table public.profiles add constraint profiles_cafe_nick_chk check (cafe_nick is null or char_length(cafe_nick) between 1 and 30);

-- 회원 본인: 카페 닉네임 저장 (비우면 지움)
create or replace function public.set_my_cafe_nick(p_nick text)
returns void language plpgsql security definer set search_path = public as $$
declare v text := nullif(btrim(coalesce(p_nick, '')), '');
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다' using errcode = '42501'; end if;
  if v is not null and char_length(v) > 30 then raise exception '카페 닉네임은 30자까지입니다' using errcode = '22023'; end if;
  update public.profiles set cafe_nick = v where id = auth.uid();
end $$;

-- 등업 처리 기록 (세대 기준)
create table if not exists public.cafe_grades (
  unit_id    text primary key references public.units (id),
  state      text not null check (state in ('up', 'down')),
  cafe_nick  text check (cafe_nick is null or char_length(cafe_nick) <= 30),   -- 처리할 때의 닉네임 (나중에 바뀌면 다시 확인)
  at         timestamptz not null default now(),
  by_user    uuid
);
alter table public.cafe_grades enable row level security;
revoke all on public.cafe_grades from anon, authenticated;

-- 운영진: 등업 대상 목록
--   status: 회원 상태(없으면 계정 없음), agreed: 위임 여부, nick: 위임장 > 내 정보 순서의 카페 닉네임
create or replace function public.cafe_list()
returns table (unit_id text, status text, agreed boolean, nick text, state text, marked_nick text, marked_at timestamptz)
language sql stable security definer set search_path = public as $$
  with m as (
    select p.unit_id, p.status, p.cafe_nick as pnick from public.profiles p where p.unit_id is not null
  ), a as (
    select ag.unit_id, ag.cafe_nick as anick from public.agreements ag
    left join public.profiles pp on pp.id = ag.user_id
    where ag.source = 'paper' or pp.status = 'approved'
  ), u as (
    select unit_id from m union select unit_id from a union select unit_id from public.cafe_grades
  )
  select u.unit_id, m.status, (a.unit_id is not null), coalesce(a.anick, m.pnick), g.state, g.cafe_nick, g.at
  from u left join m on m.unit_id = u.unit_id left join a on a.unit_id = u.unit_id left join public.cafe_grades g on g.unit_id = u.unit_id
  where public.is_admin()
  order by u.unit_id;
$$;

-- 운영진: 등업함 / 내림 / 기록 지움
create or replace function public.cafe_mark(p_unit text, p_state text)
returns void language plpgsql security definer set search_path = public as $$
declare v_nick text;
begin
  if not public.is_admin() then raise exception '운영진만 처리할 수 있습니다' using errcode = '42501'; end if;
  if p_state is null or p_state = '' then delete from public.cafe_grades where unit_id = p_unit; return; end if;
  if p_state not in ('up', 'down') then raise exception '잘못된 처리입니다' using errcode = '22023'; end if;
  select l.nick into v_nick from public.cafe_list() l where l.unit_id = p_unit;
  insert into public.cafe_grades (unit_id, state, cafe_nick, at, by_user) values (p_unit, p_state, v_nick, now(), auth.uid())
  on conflict (unit_id) do update set state = excluded.state, cafe_nick = excluded.cafe_nick, at = excluded.at, by_user = excluded.by_user;
end $$;

revoke all on function public.set_my_cafe_nick(text) from public;
revoke all on function public.cafe_list() from public;
revoke all on function public.cafe_mark(text, text) from public;
grant execute on function public.set_my_cafe_nick(text) to authenticated;
grant execute on function public.cafe_list() to authenticated;
grant execute on function public.cafe_mark(text, text) to authenticated;
notify pgrst, 'reload schema';

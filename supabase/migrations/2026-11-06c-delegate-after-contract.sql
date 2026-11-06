-- 가입과 위임 분리 (2026-11-06)
-- · 가입 승인: 당첨 확인 화면 또는 계약서 사진. 위임장 없이도 승인됨
-- · 위임장: 공급계약(2026-11-16~) 후 제출
-- · 가입 회원: 게시판 읽기 · 쓰기 · 댓글, 투표 결과 보기
-- · 위임 회원(위임장 제출 세대): + 투표 · 민원 참여, 세대별 위임 현황
-- (2026-11-06-withdraw-and-logs.sql, 2026-11-06b-signature-paper.sql 다음에 실행)

-- 위임장 제출 시작 시각 (바꾸려면 SQL Editor에서 app_settings 값만 수정)
create table if not exists public.app_settings (key text primary key, value text not null);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
insert into public.app_settings (key, value) values ('consent_open_at', '2026-11-16 00:00:00+09') on conflict (key) do nothing;
create or replace function public.consent_open_at() returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce((select value::timestamptz from public.app_settings where key = 'consent_open_at'), timestamptz '2026-11-16 00:00:00+09');
$$;
grant execute on function public.consent_open_at() to anon, authenticated;

-- 가입 회원 = 승인된 세대
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_unit() is not null;
$$;
-- 위임 회원 = 승인 + 위임장 (운영진은 예외)
create or replace function public.is_delegate() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'approved'
      and (p.is_admin or exists (select 1 from public.agreements a where a.user_id = p.id))
  );
$$;
grant execute on function public.is_delegate() to authenticated;

-- 승인에 위임장 필요 없음
drop trigger if exists profiles_require_consent on public.profiles;
drop function if exists public.profiles_require_consent();

-- 투표 · 민원 참여 = 위임 회원
create or replace function public.vote_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare pl public.polls;
begin
  if not public.is_api_request() then return new; end if;
  if public.my_unit() is null then raise exception '승인된 회원만 투표할 수 있습니다' using errcode = '42501'; end if;
  if not public.is_delegate() then raise exception '위임장을 낸 세대만 투표할 수 있습니다' using errcode = '42501'; end if;
  select * into pl from public.polls where id = new.poll_id;
  if not found then raise exception '없는 투표입니다'; end if;
  if pl.ends_at < now() then raise exception '마감된 투표입니다' using errcode = '42501'; end if;
  if new.option_idx < 0 or new.option_idx >= array_length(pl.options, 1) then raise exception '없는 선택지입니다'; end if;
  new.unit_id := public.my_unit(); new.user_id := auth.uid(); new.voted_at := now();
  return new;
end $$;
create or replace function public.join_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_api_request() then return new; end if;
  if public.my_unit() is null then raise exception '승인된 회원만 참여할 수 있습니다' using errcode = '42501'; end if;
  if not public.is_delegate() then raise exception '위임장을 낸 세대만 민원에 참여할 수 있습니다' using errcode = '42501'; end if;
  if not exists (select 1 from public.campaigns c where c.id = new.campaign_id and c.status = '의견 모집') then
    raise exception '의견 모집 중인 민원이 아닙니다' using errcode = '42501';
  end if;
  new.unit_id := public.my_unit(); new.user_id := auth.uid(); new.joined_at := now();
  return new;
end $$;
drop policy if exists votes_insert on public.poll_votes;
create policy votes_insert on public.poll_votes for insert to authenticated with check (public.is_delegate());
drop policy if exists joins_insert on public.campaign_joins;
create policy joins_insert on public.campaign_joins for insert to authenticated with check (public.is_delegate());

-- 세대별 위임 현황(어느 호수가 위임했는지) = 위임 회원 · 운영진
create or replace function public.agreed_units()
returns setof text
language sql stable security definer set search_path = public as $$
  select a.unit_id from public.agreements a left join public.profiles p on p.id = a.user_id and p.status = 'approved'
  where (a.source = 'paper' or p.id is not null) and (public.is_delegate() or public.is_admin());
$$;

notify pgrst, 'reload schema';

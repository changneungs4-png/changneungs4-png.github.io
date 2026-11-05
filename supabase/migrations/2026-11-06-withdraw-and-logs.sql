-- 위임 철회 = 회원 이용 중지, 가입 · 승인 이력 기록 (2026-11-06)

-- 1) 회원(게시판 · 투표 · 민원 · 세대별 현황) = 승인 + 위임동의. 운영진은 예외
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'approved'
      and (p.is_admin or exists (select 1 from public.agreements a where a.user_id = p.id))
  );
$$;

-- 게시판 · 댓글 · 투표 · 민원 참여 정책은 모두 is_member()를 쓰므로 함께 적용됩니다.

-- 2) 위임 제출 · 철회 기록에 처리한 사람(본인 또는 운영진) 추가
alter table public.agreement_log add column if not exists by_user uuid;
create or replace function public.agreements_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then insert into public.agreement_log (unit_id, user_id, action, by_user) values (new.unit_id, new.user_id, 'sign', auth.uid());
  else insert into public.agreement_log (unit_id, user_id, action, by_user) values (old.unit_id, old.user_id, 'withdraw', auth.uid()); end if;
  return null;
end $$;

-- 3) 가입 · 승인 · 반려 · 승인 취소 · 운영진 지정 · 계정 삭제 이력 (지우지 않고 쌓기만 함)
create table if not exists public.member_log (
  id          bigint generated always as identity primary key,
  profile_id  uuid,
  unit_id     text not null,
  action      text not null check (action in ('signup', 'approve', 'reject', 'reapply', 'revoke', 'admin_on', 'admin_off', 'delete')),
  note        text,
  by_user     uuid,
  at          timestamptz not null default now()
);
alter table public.member_log enable row level security;
drop policy if exists member_log_select on public.member_log;
create policy member_log_select on public.member_log for select to authenticated using (public.is_admin());
revoke all on public.member_log from anon, authenticated;
grant select on public.member_log to authenticated;

create or replace function public.profiles_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare a text;
begin
  if tg_op = 'INSERT' then
    insert into public.member_log (profile_id, unit_id, action, by_user) values (new.id, new.unit_id, 'signup', auth.uid());
    return null;
  end if;
  if tg_op = 'DELETE' then
    insert into public.member_log (profile_id, unit_id, action, by_user) values (old.id, old.unit_id, 'delete', auth.uid());
    return null;
  end if;
  if new.status is distinct from old.status then
    a := case
      when new.status = 'approved' then 'approve'
      when old.status = 'approved' then 'revoke'
      when new.status = 'rejected' then 'reject'
      when old.status = 'rejected' and new.status = 'pending' then 'reapply'
    end;
    if a is not null then
      insert into public.member_log (profile_id, unit_id, action, note, by_user)
      values (new.id, new.unit_id, a, case when a in ('reject', 'revoke') then new.reject_reason end, auth.uid());
    end if;
  end if;
  if new.is_admin is distinct from old.is_admin then
    insert into public.member_log (profile_id, unit_id, action, by_user) values (new.id, new.unit_id, case when new.is_admin then 'admin_on' else 'admin_off' end, auth.uid());
  end if;
  return null;
end $$;
drop trigger if exists profiles_log on public.profiles;
create trigger profiles_log after insert or update or delete on public.profiles
  for each row execute function public.profiles_log();

-- 지금까지의 가입 · 승인은 남아 있는 날짜로 한 번 채워 둠
insert into public.member_log (profile_id, unit_id, action, at)
select p.id, p.unit_id, 'signup', p.created_at from public.profiles p
where not exists (select 1 from public.member_log m where m.profile_id = p.id and m.action = 'signup');
insert into public.member_log (profile_id, unit_id, action, by_user, at)
select p.id, p.unit_id, 'approve', p.reviewed_by, coalesce(p.reviewed_at, p.created_at) from public.profiles p
where p.status = 'approved' and not exists (select 1 from public.member_log m where m.profile_id = p.id and m.action = 'approve');

notify pgrst, 'reload schema';

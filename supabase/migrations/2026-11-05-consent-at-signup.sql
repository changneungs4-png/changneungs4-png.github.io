-- 가입할 때 위임동의서를 함께 받도록 변경 (2026-11-05)
-- · 승인 대기 회원도 위임동의서를 낼 수 있음 (가입 화면에서 함께 제출)
-- · 현황판 집계는 승인된 회원의 동의만 셈
-- · 위임동의서가 없는 세대는 운영진도 승인할 수 없음
-- schema.sql에도 같은 내용이 반영되어 있습니다. 이미 운영 중인 DB에만 이 파일을 실행하세요.

-- 가입(대기 · 승인)한 본인 세대
create or replace function public.my_claimed_unit() returns text
language sql stable security definer set search_path = public as $$
  select p.unit_id from public.profiles p where p.id = auth.uid() and p.status in ('pending', 'approved');
$$;
grant execute on function public.my_claimed_unit() to authenticated;

create or replace function public.agreements_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_api_request() then return new; end if;
  if public.my_claimed_unit() is null then raise exception '가입한 회원만 위임동의서를 낼 수 있습니다' using errcode = '42501'; end if;
  new.unit_id := public.my_claimed_unit();
  new.user_id := auth.uid();
  new.signer_name := btrim(new.signer_name);
  new.signed_at := now();
  return new;
end $$;

drop policy if exists agreements_insert on public.agreements;
create policy agreements_insert on public.agreements for insert to authenticated with check (public.my_claimed_unit() is not null);

-- 공개 집계: 승인된 회원의 동의만
create or replace function public.agreement_stats()
returns table (dong int, total int, agreed int)
language sql stable security definer set search_path = public as $$
  select u.dong, count(*)::int, count(p.id)::int
  from public.units u
  left join public.agreements a on a.unit_id = u.id
  left join public.profiles p on p.id = a.user_id and p.status = 'approved'
  group by u.dong order by u.dong;
$$;

create or replace function public.agreed_units()
returns setof text
language sql stable security definer set search_path = public as $$
  select a.unit_id from public.agreements a join public.profiles p on p.id = a.user_id and p.status = 'approved'
  where public.is_member() or public.is_admin();
$$;

-- 승인 조건: 위임동의서 제출
create or replace function public.profiles_require_consent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_api_request() then return new; end if;
  if new.status = 'approved' and old.status is distinct from 'approved'
     and not exists (select 1 from public.agreements a where a.user_id = new.id) then
    raise exception '위임동의서를 내지 않은 세대는 승인할 수 없습니다' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists profiles_require_consent on public.profiles;
create trigger profiles_require_consent before update on public.profiles
  for each row execute function public.profiles_require_consent();

-- 최고 관리자 (2026-11-12)
-- 운영진 지정 · 해제는 최고 관리자만. 최고 관리자 계정의 승인 · 운영진 권한 · 위임은 다른 운영진이 바꿀 수 없다.
-- 최고 관리자를 바꾸려면 SQL Editor에서 owner_unit 값을 바꾼다.

insert into public.app_settings (key, value) values ('owner_unit', '403-1804')
on conflict (key) do nothing;

create or replace function public.owner_id() returns uuid
language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p where p.unit_id = (select value from public.app_settings where key = 'owner_unit') limit 1;
$$;
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and auth.uid() = public.owner_id();
$$;
create or replace function public.owner_unit() returns text
language sql stable security definer set search_path = public as $$
  select value from public.app_settings where key = 'owner_unit';
$$;
revoke all on function public.owner_id() from public;
grant execute on function public.is_owner(), public.owner_unit() to authenticated;

-- 기존 profiles_guard 다음에 실행 (이름 순서)
create or replace function public.profiles_guard_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare o uuid := public.owner_id();
begin
  if not public.is_api_request() or tg_op <> 'UPDATE' then return new; end if;
  if o is not null and old.id = o then
    if auth.uid() is distinct from o and (new.is_admin is distinct from old.is_admin or new.status is distinct from old.status or new.reject_reason is distinct from old.reject_reason) then
      raise exception '최고 관리자 계정은 다른 운영진이 바꿀 수 없습니다' using errcode = '42501';
    end if;
    if not new.is_admin or new.status <> 'approved' then
      raise exception '최고 관리자의 운영진 권한 · 승인은 해제할 수 없습니다' using errcode = '42501';
    end if;
  end if;
  if new.is_admin is distinct from old.is_admin and o is not null and auth.uid() is distinct from o then
    raise exception '운영진 지정 · 해제는 최고 관리자만 할 수 있습니다' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_owner on public.profiles;
create trigger profiles_guard_owner before update on public.profiles for each row execute function public.profiles_guard_owner();

-- 최고 관리자의 위임동의서는 본인만 철회
create or replace function public.agreements_owner_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_api_request() and old.user_id is not null and old.user_id = public.owner_id() and auth.uid() is distinct from old.user_id then
    raise exception '최고 관리자의 위임동의는 본인만 철회할 수 있습니다' using errcode = '42501';
  end if;
  return old;
end $$;
drop trigger if exists agreements_owner_guard on public.agreements;
create trigger agreements_owner_guard before delete on public.agreements for each row execute function public.agreements_owner_guard();

-- 계정 삭제: 운영진 · 최고 관리자 계정은 화면에서 지울 수 없음 (기존과 같음, 최고 관리자도 명시)
create or replace function public.admin_delete_account(p_user uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception '운영진만 할 수 있습니다' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception '자기 계정은 삭제할 수 없습니다' using errcode = '42501'; end if;
  if p_user = public.owner_id() then raise exception '최고 관리자 계정은 삭제할 수 없습니다' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = p_user and is_admin) then raise exception '운영진 계정은 SQL Editor에서만 삭제할 수 있습니다' using errcode = '42501'; end if;
  delete from auth.users where id = p_user;
end $$;
notify pgrst, 'reload schema';

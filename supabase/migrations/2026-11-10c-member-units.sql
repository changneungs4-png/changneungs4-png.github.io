-- 가입(승인)했지만 위임 전인 세대를 현황판에 다른 색으로 (2026-11-10)
-- 세대 번호는 위임 회원 · 운영진에게만 (agreed_units와 같은 범위)
create or replace function public.member_units()
returns setof text
language sql stable security definer set search_path = public as $$
  select p.unit_id from public.profiles p
  where p.status = 'approved' and (public.is_delegate() or public.is_admin());
$$;
revoke all on function public.member_units() from public;
grant execute on function public.member_units() to authenticated;
notify pgrst, 'reload schema';

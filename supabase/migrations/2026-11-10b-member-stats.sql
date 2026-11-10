-- 동별 가입(승인) 세대 수 공개 집계 (2026-11-10)
-- 위임동의 현황판 · 첫 화면에 "가입 ○세대 (위임 전 ○세대)"를 함께 보여주기 위함. 세대 번호는 내보내지 않음
create or replace function public.member_stats()
returns table (dong int, members int)
language sql stable security definer set search_path = public as $$
  select split_part(p.unit_id, '-', 1)::int, count(*)::int
  from public.profiles p
  where p.status = 'approved' and p.unit_id ~ '^[0-9]+-[0-9]+$'
  group by 1 order by 1;
$$;
revoke all on function public.member_stats() from public;
grant execute on function public.member_stats() to anon, authenticated;
notify pgrst, 'reload schema';

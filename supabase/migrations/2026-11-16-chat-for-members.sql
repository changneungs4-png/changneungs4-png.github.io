-- 2026-11-16: 입주민 오픈채팅 입장 정보를 위임동의 전이라도 가입 승인된 회원이면 볼 수 있게
create or replace function public.chat_info_get()
returns table (url text, password text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.url, c.password, c.updated_at from public.chat_info c
  where c.id = 1 and (public.is_member() or public.is_admin());
$$;
revoke all on function public.chat_info_get() from public;
grant execute on function public.chat_info_get() to authenticated;
notify pgrst, 'reload schema';

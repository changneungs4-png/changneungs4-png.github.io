-- 2026-11-20 가입 절차 변경: 계약서 인증은 네이버 카페, 홈페이지는 위임동의만
--  · 홈페이지 가입 = 동·호수 + 비밀번호 + 카페 닉네임 (계약서 사진 없음). 운영진이 카페 인증을 확인해 승인 → 집계 반영
--  · 회원 기능(오픈채팅 비밀번호 · 회원 전용 민원 안내)은 '승인 + 위임동의' 세대(운영진 포함)에게만
create or replace function public.chat_info_get()
returns table (url text, password text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.url, c.password, c.updated_at from public.chat_info c
  where c.id = 1 and (public.is_delegate() or public.is_admin());
$$;
revoke all on function public.chat_info_get() from public;
grant execute on function public.chat_info_get() to authenticated;

create or replace function public.private_note_get(p_key text)
returns table (body text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select n.body, n.updated_at from public.private_notes n where n.key = p_key and (public.is_delegate() or public.is_admin());
$$;
notify pgrst, 'reload schema';

-- 확인: 남은 계약서 사진 경로 수 (운영진 페이지 '남은 계약서 사진 모두 삭제'로 지운 뒤 0이어야 함)
select count(*) filter (where contract_path is not null) as 계약서_남은_세대, count(*) filter (where status = 'pending') as 확인_대기 from public.profiles;

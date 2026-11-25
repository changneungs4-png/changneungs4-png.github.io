-- 2026-11-25 · 비밀번호를 잊은 회원: 운영진이 임시 비밀번호로 초기화
-- 아이디가 동 · 호수(가짜 메일)라 메일로 재설정 링크를 보낼 수 없어, 운영진이 임시 비밀번호를 정해 카페 쪽지로 알려 주는 방식
-- · 운영진만 가능, 자기 계정은 불가(내 정보에서 바꿈), 최고 관리자 · 다른 운영진 계정은 최고 관리자만 가능
-- · 초기화하면 그 회원의 기존 로그인(세션)은 모두 끊김, 이력(member_log)에 '비밀번호 초기화'로 남음(비밀번호는 남기지 않음)
alter table public.member_log drop constraint if exists member_log_action_check;
alter table public.member_log add constraint member_log_action_check
  check (action in ('signup', 'approve', 'reject', 'reapply', 'revoke', 'admin_on', 'admin_off', 'delete', 'pw_reset'));

create or replace function public.admin_reset_password(p_user uuid, p_pw text)
returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
declare u text;
begin
  if not public.is_admin() then raise exception '운영진만 할 수 있습니다' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception '내 비밀번호는 내 정보에서 바꿀 수 있습니다' using errcode = '42501'; end if;
  if p_pw is null or length(p_pw) < 8 or length(p_pw) > 72 then raise exception '임시 비밀번호는 8자 이상 72자 이하로 넣어 주세요' using errcode = '22023'; end if;
  if (p_user = public.owner_id() or exists (select 1 from public.profiles where id = p_user and is_admin)) and not public.is_owner() then
    raise exception '운영진 · 최고 관리자 계정은 최고 관리자만 초기화할 수 있습니다' using errcode = '42501';
  end if;
  select unit_id into u from public.profiles where id = p_user;
  if u is null then raise exception '회원을 찾을 수 없습니다' using errcode = 'P0002'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_pw, extensions.gen_salt('bf')), updated_at = now() where id = p_user;
  delete from auth.refresh_tokens where user_id::text = p_user::text;
  delete from auth.sessions where user_id = p_user;
  insert into public.member_log (profile_id, unit_id, action, by_user) values (p_user, u, 'pw_reset', auth.uid());
end $$;
revoke all on function public.admin_reset_password(uuid, text) from public, anon;
grant execute on function public.admin_reset_password(uuid, text) to authenticated;
notify pgrst, 'reload schema';

-- 2026-11-21b · 휴대전화번호(선택 항목) 동의를 회원이 직접 바꾸기
-- 예전에 필수로 받은 번호도 내 정보에서 철회(삭제)하거나 새로 동의할 수 있음

alter table public.agreements add column if not exists contact_updated_at timestamptz;

create or replace function public.set_my_contact(p_agree boolean, p_phone text)
returns void language plpgsql security definer set search_path = public as $$
declare v text := nullif(regexp_replace(coalesce(p_phone, ''), '\s', '', 'g'), '');
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다' using errcode = '42501'; end if;
  if coalesce(p_agree, false) and (v is null or v !~ '^01[016789]-?[0-9]{3,4}-?[0-9]{4}$') then
    raise exception '휴대전화번호를 바르게 입력하세요' using errcode = '22023';
  end if;
  update public.agreements
     set agree_contact = coalesce(p_agree, false),
         phone = case when coalesce(p_agree, false) then v else null end,
         contact_updated_at = now()
   where user_id = auth.uid() and source <> 'paper';
  if not found then raise exception '홈페이지로 제출한 위임동의서가 없습니다' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.set_my_contact(boolean, text) from public, anon;
grant execute on function public.set_my_contact(boolean, text) to authenticated;

notify pgrst, 'reload schema';

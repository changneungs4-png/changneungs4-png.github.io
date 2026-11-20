-- 2026-11-20: 위임동의는 가입 승인(카페 인증 확인) 뒤에만
--  · 온라인 위임동의서는 승인된 회원 본인만 낼 수 있음 (운영진이 대신 등록하는 서면 위임은 예외)
--  · 오픈채팅 · 회원 기능은 이미 '승인 + 위임' 기준(is_delegate)이라 그대로
create or replace function public.agreements_require_approved() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_api_request() or new.source = 'paper' or public.is_admin() then return new; end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'approved') then
    raise exception '운영진이 카페 인증을 확인(가입 승인)한 뒤에 위임동의서를 낼 수 있습니다' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists agreements_require_approved on public.agreements;
create trigger agreements_require_approved before insert on public.agreements for each row execute function public.agreements_require_approved();
notify pgrst, 'reload schema';

-- 확인: 승인 전에 이미 낸 위임동의서 (집계에는 들어가지 않음 · 승인하면 반영)
select a.unit_id as 세대, p.status as 가입상태, a.signed_at as 제출일시
from public.agreements a join public.profiles p on p.id = a.user_id
where p.status <> 'approved' order by a.signed_at;

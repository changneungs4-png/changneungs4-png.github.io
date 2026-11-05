-- 위임동의서에서 계약자 성명을 받지 않음 (개인정보 최소 수집, 2026-11-05)
-- 위임은 세대 단위: 계약서 사진으로 운영진이 확인한 계정 = 그 세대
-- 이미 받은 성명은 지웁니다. (2026-11-05-consent-at-signup.sql 다음에 실행)
alter table public.agreements alter column signer_name drop not null;
alter table public.agreements drop constraint if exists agreements_signer_name_check;
update public.agreements set signer_name = null where signer_name is not null;

create or replace function public.agreements_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_api_request() then return new; end if;
  if public.my_claimed_unit() is null then raise exception '가입한 회원만 위임동의서를 낼 수 있습니다' using errcode = '42501'; end if;
  new.unit_id := public.my_claimed_unit();
  new.user_id := auth.uid();
  new.signer_name := null;      -- 성명은 받지 않음
  new.signed_at := now();
  return new;
end $$;

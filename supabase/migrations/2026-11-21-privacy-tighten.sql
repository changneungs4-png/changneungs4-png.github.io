-- 2026-11-21 · 개인정보 정리
-- 1) 세대별 위임 · 가입 여부는 운영진만 (회원 · 방문자는 동별 숫자만)
-- 2) 휴대전화번호는 선택 항목: 연락처 수집에 동의(agree_contact)한 경우에만 저장
-- 3) 세대별 회비 내역 함수는 운영진 전용 함수(dues_units)로만 접근

create or replace function public.agreed_units()
returns setof text
language sql stable security definer set search_path = public as $$
  select a.unit_id from public.agreements a left join public.profiles p on p.id = a.user_id and p.status = 'approved'
  where (a.source = 'paper' or p.id is not null) and public.is_admin();
$$;

create or replace function public.member_units()
returns setof text
language sql stable security definer set search_path = public as $$
  select p.unit_id from public.profiles p
  where p.status = 'approved' and public.is_admin();
$$;
revoke all on function public.member_units() from public, anon;
grant execute on function public.member_units() to authenticated;

revoke all on function public.dues_by_unit() from public, anon, authenticated;

create or replace function public.agreements_guard_v6() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_api_request() then return new; end if;
  new.cafe_nick := nullif(btrim(coalesce(new.cafe_nick, '')), '');
  new.co_name := nullif(btrim(coalesce(new.co_name, '')), '');
  new.rep_name := nullif(btrim(coalesce(new.rep_name, '')), '');
  -- 휴대전화번호는 선택: 동의한 경우에만 저장
  if not coalesce(new.agree_contact, false) then new.phone := null; end if;
  if new.agree_contact and nullif(btrim(coalesce(new.phone, '')), '') is null then
    raise exception '연락처 수집에 동의했다면 휴대전화번호를 입력하세요' using errcode = '22023';
  end if;
  if new.phone is not null and new.phone !~ '^01[016789]-?[0-9]{3,4}-?[0-9]{4}$' then
    raise exception '휴대전화번호 형식이 올바르지 않습니다' using errcode = '22023';
  end if;
  if new.source = 'paper' then
    new.co_signature := null; new.co_name := null; new.rep_name := null;
  else
    if new.co_signature is null then new.co_name := null; new.rep_name := null; end if;
    if new.co_signature is not null and (new.co_name is null or char_length(new.co_name) not between 2 and 30) then
      raise exception '공동명의자 성명을 입력하세요' using errcode = '22023';
    end if;
    if new.co_signature is not null and new.form_version >= '2026-11-v7' and (new.rep_name is null or new.rep_name not in (new.signer_name, new.co_name)) then
      raise exception '대표 회원은 계약자나 공동명의자 중 한 명이어야 합니다' using errcode = '22023';
    end if;
  end if;
  new.doc_hash := encode(digest(concat_ws('|', new.doc_hash, coalesce(new.cafe_nick, ''), coalesce(new.co_name, ''),
      coalesce(encode(digest(new.co_signature, 'sha256'), 'hex'), ''), coalesce(new.rep_name, '')), 'sha256'), 'hex');
  return new;
end $$;

notify pgrst, 'reload schema';

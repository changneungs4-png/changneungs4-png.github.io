-- 확정 동의서(v7) 반영 (2026-11-12)
-- 공동명의 세대의 대표 회원 성명 추가. 휴대전화 필수는 v6 이후 모든 온라인 양식에 적용. 카페 닉네임은 받지 않음.
alter table public.agreements add column if not exists rep_name text;
alter table public.agreements drop constraint if exists agreements_rep_chk;
alter table public.agreements add constraint agreements_rep_chk check (rep_name is null or char_length(rep_name) between 2 and 30);

create or replace function public.agreements_guard_v6() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_api_request() then return new; end if;
  new.cafe_nick := nullif(btrim(coalesce(new.cafe_nick, '')), '');
  new.co_name := nullif(btrim(coalesce(new.co_name, '')), '');
  new.rep_name := nullif(btrim(coalesce(new.rep_name, '')), '');
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
    if new.form_version >= '2026-11-v6' and new.form_version < '2026-11-w' and new.phone is null then
      raise exception '휴대전화번호를 입력하세요' using errcode = '22023';
    end if;
  end if;
  new.doc_hash := encode(digest(concat_ws('|', new.doc_hash, coalesce(new.cafe_nick, ''), coalesce(new.co_name, ''),
      coalesce(encode(digest(new.co_signature, 'sha256'), 'hex'), ''), coalesce(new.rep_name, '')), 'sha256'), 'hex');
  return new;
end $$;
notify pgrst, 'reload schema';

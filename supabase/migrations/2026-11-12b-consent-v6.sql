-- 위임동의서 v6 (2026-11-12): 준비위원회 「입예협 구성 및 위임 동의서」 반영
-- 추가 항목: 카페 닉네임(선택), 공동명의자 성명 · 서명(공동명의자가 직접 서명할 때만)
-- 휴대전화번호는 v6부터 수집 항목(필수)이라 온라인 제출에서 반드시 받는다.

alter table public.agreements add column if not exists cafe_nick    text;
alter table public.agreements add column if not exists co_name      text;
alter table public.agreements add column if not exists co_signature text;

alter table public.agreements drop constraint if exists agreements_cafe_nick_chk;
alter table public.agreements add constraint agreements_cafe_nick_chk check (cafe_nick is null or char_length(cafe_nick) between 1 and 30);
alter table public.agreements drop constraint if exists agreements_co_chk;
alter table public.agreements add constraint agreements_co_chk check (
  (co_name is null and co_signature is null)
  or (char_length(co_name) between 2 and 30 and co_signature like 'data:image/png;base64,%' and char_length(co_signature) between 200 and 300000));

-- 기존 agreements_guard 다음에 실행 (트리거는 이름 순서): 새 항목 정리 · 검사 후 문서 지문에 함께 묶음
create or replace function public.agreements_guard_v6() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_api_request() then return new; end if;
  new.cafe_nick := nullif(btrim(coalesce(new.cafe_nick, '')), '');
  new.co_name := nullif(btrim(coalesce(new.co_name, '')), '');
  if new.source = 'paper' then
    new.co_signature := null; new.co_name := null;
  else
    if new.co_signature is null then new.co_name := null; end if;
    if new.co_signature is not null and (new.co_name is null or char_length(new.co_name) not between 2 and 30) then
      raise exception '공동명의자 성명을 입력하세요' using errcode = '22023';
    end if;
    if new.form_version like '2026-11-v6%' and new.phone is null then
      raise exception '휴대전화번호를 입력하세요' using errcode = '22023';
    end if;
  end if;
  new.doc_hash := encode(digest(concat_ws('|', new.doc_hash, coalesce(new.cafe_nick, ''), coalesce(new.co_name, ''),
      coalesce(encode(digest(new.co_signature, 'sha256'), 'hex'), '')), 'sha256'), 'hex');
  return new;
end $$;
drop trigger if exists agreements_guard_v6 on public.agreements;
create trigger agreements_guard_v6 before insert on public.agreements for each row execute function public.agreements_guard_v6();
notify pgrst, 'reload schema';

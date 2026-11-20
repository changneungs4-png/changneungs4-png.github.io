-- 2026-11-20c · 가입할 때 네이버 카페 닉네임 필수
-- 절차: 카페 가입(계약 인증) → 홈페이지 가입(위임동의) → 회비 납부
-- 운영진은 이 닉네임으로 카페 인증 여부를 확인하고 승인합니다.

create or replace function public.profiles_cafe_nick_required() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_api_request() or public.is_admin() then return new; end if;
  new.cafe_nick := nullif(btrim(coalesce(new.cafe_nick, '')), '');
  if tg_op = 'UPDATE' and new.cafe_nick is not distinct from old.cafe_nick then return new; end if;
  if new.cafe_nick is null then
    raise exception '네이버 카페 닉네임을 입력하세요' using errcode = '22023';
  end if;
  if char_length(new.cafe_nick) > 30 then
    raise exception '카페 닉네임은 30자까지입니다' using errcode = '22023';
  end if;
  return new;
end $$;

drop trigger if exists profiles_cafe_nick_required on public.profiles;
create trigger profiles_cafe_nick_required before insert or update of cafe_nick on public.profiles
  for each row execute function public.profiles_cafe_nick_required();

-- 계정 페이지에서 닉네임을 비울 수 없게
create or replace function public.set_my_cafe_nick(p_nick text)
returns void language plpgsql security definer set search_path = public as $$
declare v text := nullif(btrim(coalesce(p_nick, '')), '');
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다' using errcode = '42501'; end if;
  if v is null then raise exception '네이버 카페 닉네임을 입력하세요' using errcode = '22023'; end if;
  if char_length(v) > 30 then raise exception '카페 닉네임은 30자까지입니다' using errcode = '22023'; end if;
  update public.profiles set cafe_nick = v where id = auth.uid();
end $$;
revoke all on function public.set_my_cafe_nick(text) from public;
grant execute on function public.set_my_cafe_nick(text) to authenticated;

-- 가입 시작 시각을 위임동의 시작 시각과 따로 (2026-11-12)
-- 회장단이 먼저 가입해 운영진 권한을 받을 수 있게 가입은 지금 열고, 위임동의서는 그대로 공급계약 시작(11.16)부터.
-- 미리 가입한 계정은 '대기'로 남고, 운영진이 승인한 세대만 이용할 수 있다.

insert into public.app_settings (key, value) values ('signup_open_at', '2026-11-12 15:00:00+09')
on conflict (key) do update set value = excluded.value;

create or replace function public.signup_open_at() returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce((select value::timestamptz from public.app_settings where key = 'signup_open_at'), public.consent_open_at());
$$;
grant execute on function public.signup_open_at() to anon, authenticated;

create or replace function public.profiles_open_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_api_request() then return new; end if;
  if now() < public.signup_open_at() then
    raise exception '가입은 % 부터 받습니다', to_char(public.signup_open_at() at time zone 'Asia/Seoul', 'FMMM"월" FMDD"일"') using errcode = '42501';
  end if;
  return new;
end $$;
notify pgrst, 'reload schema';

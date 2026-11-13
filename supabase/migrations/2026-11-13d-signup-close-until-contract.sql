-- 운영진 선가입 종료 (2026-11-13)
-- 가입과 위임동의서 모두 다시 공급계약 시작(2026-11-16 00:00 KST)부터.
-- signup_open_at 설정을 지우면 signup_open_at()이 consent_open_at()을 따르고,
-- 가입 차단 트리거(profiles_open_guard)가 그 시각 전 새 가입을 서버에서 막는다.
-- 이미 가입 · 승인된 운영진 계정은 그대로 둔다.

delete from public.app_settings where key = 'signup_open_at';
insert into public.app_settings (key, value) values ('consent_open_at', '2026-11-16 00:00:00+09')
on conflict (key) do update set value = excluded.value;
notify pgrst, 'reload schema';

-- 확인: 두 시각 모두 2026-11-16 00:00 KST 여야 함
select public.signup_open_at() at time zone 'Asia/Seoul' as 가입_시작,
       public.consent_open_at() at time zone 'Asia/Seoul' as 위임동의_시작;

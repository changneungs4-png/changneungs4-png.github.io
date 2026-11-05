-- 운영진 메일 알림: 어떤 가입 신청을 이미 알렸는지 기록 (GitHub Actions 알림이 service_role로 사용)
create table if not exists public.signup_notices (
  profile_id  uuid primary key references public.profiles (id) on delete cascade,
  notified_at timestamptz not null default now()
);
alter table public.signup_notices enable row level security;   -- 웹(anon/authenticated)에는 정책 없음 = 접근 불가
revoke all on public.signup_notices from anon, authenticated;
grant select, insert on public.signup_notices to service_role;
-- 알림에 필요한 최소 읽기 권한 (세대 · 신청 시각 · 위임동의 여부)
grant select (id, unit_id, status, created_at) on public.profiles to service_role;
grant select (user_id) on public.agreements to service_role;
notify pgrst, 'reload schema';

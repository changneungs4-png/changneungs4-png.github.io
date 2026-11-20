-- 2026-11-21c · 비로그인 상태에서 "이 세대가 가입했는지" 조회하는 통로 닫기
-- 예전에는 가입 화면이 미리 확인하려고 누구나 부를 수 있었음 → 1,024세대를 돌려 보면 가입 세대 목록이 드러남
-- 이제 중복 가입은 로그인 서버(Supabase Auth)가 막고, 그쪽은 IP당 요청 횟수 제한이 걸려 있음
revoke all on function public.unit_taken(text) from public, anon, authenticated;
notify pgrst, 'reload schema';

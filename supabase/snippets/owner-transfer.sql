-- 최고 관리자 넘기기
-- 1) 아래 '403-1804'를 새 최고 관리자 세대(예: '405-1203')로 바꾸고
-- 2) 맨 앞 '-- '를 지운 뒤 Run
-- 새 세대는 홈페이지에 가입해 승인된 상태여야 합니다. 운영진 권한도 함께 켭니다.

-- update public.profiles set is_admin = true where unit_id = '403-1804' and status = 'approved';
-- update public.app_settings set value = '403-1804' where key = 'owner_unit';

-- 확인: 지금 최고 관리자 세대와 그 계정 상태
select s.value as 최고관리자_세대, p.status as 상태, p.is_admin as 운영진
from public.app_settings s left join public.profiles p on p.unit_id = s.value
where s.key = 'owner_unit';

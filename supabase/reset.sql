-- ════════════════════════════════════════════════════════════════
--  테스트 데이터 초기화 (정식 오픈 직전에 한 번)
--  SQL Editor에서 실행. 되돌릴 수 없습니다.
--  지우는 것: 모든 회원 계정 · 위임동의 · 기록 · 게시글 · 댓글 · 투표 · 민원 · 자동 수집 소식
--  남기는 것: 테이블 · 보안 정책 · 동·호수 배치표 · 매일 수집 예약
--  계약서 사진은 SQL로 지울 수 없으니 Storage → contracts → 모든 파일 선택 → Delete 로 비워주세요.
-- ════════════════════════════════════════════════════════════════
begin;
delete from public.campaign_joins;
delete from public.campaigns;
delete from public.poll_votes;
delete from public.polls;
delete from public.comments;
delete from public.posts;
delete from public.agreements;
delete from public.agreement_log;
delete from public.news_items;
delete from public.profiles;
delete from auth.users;          -- 로그인 세션 · 토큰도 함께 지워짐
commit;

-- 확인 (모두 0이어야 합니다)
select (select count(*) from auth.users) as 계정, (select count(*) from public.profiles) as 회원,
       (select count(*) from public.agreements) as 위임동의, (select count(*) from public.posts) as 게시글,
       (select count(*) from public.news_items) as 소식, (select count(*) from public.units) as 세대_남아야함;
-- 초기화 뒤: 운영진이 다시 가입 → README ⑤의 SQL로 운영진 지정 → 운영진 페이지 "지금 수집"으로 소식 다시 채우기

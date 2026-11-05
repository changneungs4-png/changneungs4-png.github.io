-- 매일 아침 7시 13분(한국 시간)에 소식 수집기를 실행합니다.
-- 실행 전: ① Edge Function collect-news 배포 ② Secrets에 CRON_SECRET 등록
-- 아래 두 값을 바꿔서 SQL Editor에서 실행하세요.
--   <PROJECT_REF>  : 프로젝트 주소 https://<PROJECT_REF>.supabase.co 의 앞부분
--   <CRON_SECRET>  : Edge Function Secrets에 넣은 것과 같은 값
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('<CRON_SECRET>', 'collect_news_secret')
where not exists (select 1 from vault.secrets where name = 'collect_news_secret');

select cron.unschedule('collect-news') where exists (select 1 from cron.job where jobname = 'collect-news');
select cron.schedule(
  'collect-news',
  '13 22 * * *',            -- UTC 22:13 = 한국 07:13
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/collect-news',
    headers := jsonb_build_object('content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'collect_news_secret')),
    body := '{}'::jsonb
  );
  $$
);
-- 확인: select * from cron.job;  실행 기록: select * from cron.job_run_details order by start_time desc limit 5;

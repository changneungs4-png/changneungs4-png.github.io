-- 매일 아침 7시 13분(한국 시간)에 소식 수집기를 실행합니다.
-- 실행 전: Edge Function collect-news 배포 (Verify JWT 끔)
-- 아래 <PROJECT_REF>만 프로젝트 주소 https://<PROJECT_REF>.supabase.co 의 앞부분으로 바꿔서 실행하세요.
-- 호출용 비밀값은 DB가 직접 만들어 vault에 보관합니다(사람이 복사하거나 입력할 필요 없음).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'collect_news_secret')
where not exists (select 1 from vault.secrets where name = 'collect_news_secret');

-- 수집기가 받은 값이 vault 값과 같은지 확인 (service_role만 호출 가능)
create or replace function public.check_cron_secret(s text) returns boolean
language sql security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'collect_news_secret' and decrypted_secret = s);
$$;
revoke all on function public.check_cron_secret(text) from public, anon, authenticated;
grant execute on function public.check_cron_secret(text) to service_role;

select cron.unschedule('collect-news') where exists (select 1 from cron.job where jobname = 'collect-news');
select cron.schedule(
  'collect-news',
  '13 22 * * *',            -- UTC 22:13 = 한국 07:13
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/collect-news',
    headers := jsonb_build_object('content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'collect_news_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
-- 확인: select * from cron.job;  실행 기록: select * from net._http_response order by created desc limit 5;

-- 소식 수집 실행 기록 (2026-11-13)
-- 수집기(Edge Function)가 시작할 때 한 줄, 끝날 때 결과를 남깁니다. 150초 제한으로 강제 종료되면 '끝남'이 빈 채로 남아 실패로 보입니다.
-- 운영진 페이지(자동 수집 탭)와 알림 메일(GitHub Actions)이 이 기록을 봅니다.

create table if not exists public.collect_runs (
  id          bigserial primary key,
  source      text not null default 'manual' check (source in ('cron', 'manual')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  found       int,
  inserted    int,
  errors      jsonb not null default '[]'::jsonb,
  alerted_at  timestamptz
);
create index if not exists collect_runs_started_idx on public.collect_runs (started_at desc);
alter table public.collect_runs enable row level security;
revoke all on public.collect_runs from anon, authenticated;
grant all on public.collect_runs to service_role;
grant usage, select on sequence public.collect_runs_id_seq to service_role;

-- 운영진용 최근 기록
create or replace function public.collect_runs_recent(p_limit int default 10)
returns table (id bigint, source text, started_at timestamptz, finished_at timestamptz, ok boolean, found int, inserted int, errors jsonb)
language sql stable security definer set search_path = public as $$
  select r.id, r.source, r.started_at, r.finished_at, r.ok, r.found, r.inserted, r.errors
  from public.collect_runs r where public.is_admin()
  order by r.started_at desc limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;
revoke all on function public.collect_runs_recent(int) from public;
grant execute on function public.collect_runs_recent(int) to authenticated;

-- 90일 지난 기록은 지움 (수집 때마다 함께 정리)
create or replace function public.collect_runs_trim() returns trigger
language plpgsql security definer set search_path = public as $$
begin delete from public.collect_runs where started_at < now() - interval '90 days'; return new; end $$;
drop trigger if exists collect_runs_trim on public.collect_runs;
create trigger collect_runs_trim after insert on public.collect_runs for each statement execute function public.collect_runs_trim();

-- 매일 07:13 자동 수집: 응답을 기다리는 시간을 60초 → 150초로 (수집기 최대 실행 시간과 같게)
do $$
declare cmd text;
begin
  if to_regclass('cron.job') is null then return; end if;
  select command into cmd from cron.job where jobname = 'collect-news';
  if cmd is not null and cmd like '%timeout_milliseconds := 60000%' then
    perform cron.alter_job((select jobid from cron.job where jobname = 'collect-news'), command := replace(cmd, 'timeout_milliseconds := 60000', 'timeout_milliseconds := 150000'));
  end if;
end $$;
notify pgrst, 'reload schema';

-- 확인
select (select count(*) from cron.job where jobname = 'collect-news') as 자동수집_예약,
       (select schedule from cron.job where jobname = 'collect-news') as 예약시각_UTC,
       to_regclass('public.collect_runs') is not null as 기록표;
-- 오늘 아침 자동 실행 결과(pg_net): 
select id, status_code, left(coalesce(error_msg, content::text), 120) as 결과, created at time zone 'Asia/Seoul' as 시각
from net._http_response order by created desc limit 5;

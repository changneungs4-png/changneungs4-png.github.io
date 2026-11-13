-- 민원 문구 AI 새로 쓰기 사용 기록 (2026-11-13)
-- 한 사람당 하루 횟수 제한에만 씁니다. 문구 내용은 저장하지 않습니다. 30일 지난 기록은 지웁니다.
create table if not exists public.petition_ai_log (
  id      bigserial primary key,
  user_id uuid not null,
  kind    text not null,
  at      timestamptz not null default now()
);
create index if not exists petition_ai_log_user_idx on public.petition_ai_log (user_id, at desc);
alter table public.petition_ai_log enable row level security;
revoke all on public.petition_ai_log from anon, authenticated;
grant all on public.petition_ai_log to service_role;
grant usage, select on sequence public.petition_ai_log_id_seq to service_role;
create or replace function public.petition_ai_log_trim() returns trigger
language plpgsql security definer set search_path = public as $$
begin delete from public.petition_ai_log where at < now() - interval '30 days'; return new; end $$;
drop trigger if exists petition_ai_log_trim on public.petition_ai_log;
create trigger petition_ai_log_trim after insert on public.petition_ai_log for each statement execute function public.petition_ai_log_trim();
notify pgrst, 'reload schema';
select to_regclass('public.petition_ai_log') is not null as ai기록표;

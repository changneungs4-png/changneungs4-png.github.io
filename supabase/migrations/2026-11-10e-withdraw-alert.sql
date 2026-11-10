-- 위임동의 철회 알림: 운영진이 확인할 때까지 알림 표시 + 메일 (2026-11-10)
alter table public.agreement_log add column if not exists ack_at      timestamptz;
alter table public.agreement_log add column if not exists ack_by      uuid;
alter table public.agreement_log add column if not exists notified_at timestamptz;
-- 이미 지난 철회는 확인한 것으로
update public.agreement_log set ack_at = coalesce(ack_at, now()), notified_at = coalesce(notified_at, now()) where action = 'withdraw' and at < timestamptz '2026-11-10 18:00:00+09' and (ack_at is null or notified_at is null);

-- 운영진이 아직 확인하지 않은 '본인 철회'(그 뒤 다시 위임한 세대는 제외)
create or replace function public.withdrawals_unacked()
returns table (id bigint, unit_id text, at timestamptz, by_self boolean)
language sql stable security definer set search_path = public as $$
  select l.id, l.unit_id, l.at, (l.by_user is not null and l.by_user = l.user_id)
  from public.agreement_log l
  where public.is_admin() and l.action = 'withdraw' and l.ack_at is null
    and l.by_user is not null and l.by_user = l.user_id      -- 본인이 직접 철회한 것만(운영진 처리 · 서면→온라인 전환 제외)
    and not exists (select 1 from public.agreements a where a.unit_id = l.unit_id)
  order by l.at desc;
$$;
revoke all on function public.withdrawals_unacked() from public;
grant execute on function public.withdrawals_unacked() to authenticated;

create or replace function public.withdrawals_ack(p_ids bigint[])
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '운영진만 확인할 수 있습니다' using errcode = '42501'; end if;
  update public.agreement_log set ack_at = now(), ack_by = auth.uid() where id = any(p_ids) and action = 'withdraw' and ack_at is null;
end $$;
revoke all on function public.withdrawals_ack(bigint[]) from public;
grant execute on function public.withdrawals_ack(bigint[]) to authenticated;

-- 메일 알림(GitHub Actions)용
grant select (id, unit_id, user_id, by_user, action, at, notified_at) on public.agreement_log to service_role;
grant update (notified_at) on public.agreement_log to service_role;
grant select (unit_id) on public.agreements to service_role;   -- 다시 위임한 세대는 메일에서 뺌
notify pgrst, 'reload schema';

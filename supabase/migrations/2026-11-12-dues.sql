-- 회비 관리 (2026-11-12)
-- 총무가 은행 거래내역 파일을 올리면 입금자명의 동·호수로 세대를 맞춰 납부 현황을 만든다.
-- 입금자명 · 적요는 운영진만 본다. 누구나 보는 건 월별 합계와 운영진이 적은 공개 메모뿐.

-- 설정: 계좌 · 시기별 금액 (총회에서 정한 뒤 운영진 화면에서 입력)
create table if not exists public.dues_config (
  id          int primary key default 1 check (id = 1),
  bank        text check (bank is null or char_length(bank) <= 20),
  account     text check (account is null or account ~ '^[0-9-]{6,30}$'),
  holder      text check (holder is null or char_length(holder) <= 40),
  tiers       jsonb not null default '[]'::jsonb,   -- [{ "until": "2026-12-31", "amount": 30000 }, ...] 마지막은 until 없이 가능
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
alter table public.dues_config enable row level security;
revoke all on public.dues_config from anon, authenticated;
insert into public.dues_config (id) values (1) on conflict do nothing;

-- 은행 거래내역
create table if not exists public.bank_tx (
  id           bigint generated always as identity primary key,
  at           timestamptz not null,
  amount_in    bigint not null default 0 check (amount_in >= 0),
  amount_out   bigint not null default 0 check (amount_out >= 0),
  balance      bigint,
  payer        text not null default '' check (char_length(payer) <= 200),   -- 입금자명 · 기재내용 (운영진만)
  unit_id      text references public.units(id),
  category     text not null default '기타' check (category in ('회비', '기타', '지출')),
  matched      text not null default 'none' check (matched in ('auto', 'manual', 'none')),
  public_note  text check (public_note is null or char_length(public_note) <= 80),  -- 회계 공개에 보일 메모 (예: 현수막 제작)
  fp           text not null unique,                                          -- 같은 파일을 두 번 올려도 한 번만
  created_at   timestamptz not null default now(),
  created_by   uuid
);
create index if not exists bank_tx_unit on public.bank_tx (unit_id) where unit_id is not null;
create index if not exists bank_tx_at on public.bank_tx (at);
alter table public.bank_tx enable row level security;
revoke all on public.bank_tx from anon, authenticated;

-- 입금자명에서 동·호수 찾기: "403-1804", "4031804", "403동1804호", "403 1804홍길동"
create or replace function public.dues_unit_from(p text)
returns text language sql stable set search_path = public as $$
  select u.id from public.units u,
    lateral (select regexp_match(coalesce(p, ''), '(\d{3})\s*(?:동|-|_|\.|/|\s)?\s*(\d{3,4})(?!\d)') m) x
  where x.m is not null and u.id = x.m[1] || '-' || (x.m[2])::int
  limit 1;
$$;

-- 그 날짜에 내야 하는 금액
create or replace function public.dues_amount_at(p_day date)
returns bigint language sql stable security definer set search_path = public as $$
  select (t->>'amount')::bigint
  from public.dues_config c, jsonb_array_elements(c.tiers) with ordinality as e(t, i)
  where c.id = 1 and (t->>'until' is null or p_day <= (t->>'until')::date)
  order by i limit 1;
$$;

-- 운영진: 거래내역 올리기
create or replace function public.bank_import(p_rows jsonb)
returns table (added int, skipped int, matched int)
language plpgsql security definer set search_path = public as $$
declare r jsonb; v_at timestamptz; v_in bigint; v_out bigint; v_bal bigint; v_payer text; v_unit text; v_fp text; a int := 0; s int := 0; m int := 0;
begin
  if not public.is_admin() then raise exception '운영진만 올릴 수 있습니다' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then raise exception '행이 너무 많습니다'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_at := (r->>'at')::timestamptz;
    v_in := greatest(coalesce((r->>'in')::bigint, 0), 0);
    v_out := greatest(coalesce((r->>'out')::bigint, 0), 0);
    v_bal := (r->>'balance')::bigint;
    v_payer := left(btrim(coalesce(r->>'payer', '')), 200);
    if v_at is null or (v_in = 0 and v_out = 0) then s := s + 1; continue; end if;
    v_fp := md5(concat_ws('|', to_char(v_at at time zone 'Asia/Seoul', 'YYYYMMDDHH24MISS'), v_in, v_out, coalesce(v_bal::text, ''), v_payer, coalesce(r->>'seq', '')));
    v_unit := case when v_in > 0 then public.dues_unit_from(v_payer) end;
    insert into public.bank_tx (at, amount_in, amount_out, balance, payer, unit_id, category, matched, fp, created_by)
    values (v_at, v_in, v_out, v_bal, v_payer, v_unit,
            case when v_out > 0 then '지출' when v_unit is not null then '회비' else '기타' end,
            case when v_unit is not null then 'auto' else 'none' end, v_fp, auth.uid())
    on conflict (fp) do nothing;
    if found then a := a + 1; if v_unit is not null then m := m + 1; end if; else s := s + 1; end if;
  end loop;
  return query select a, s, m;
end $$;

-- 운영진: 거래 목록 (입금자명 포함)
create or replace function public.bank_tx_list(p_limit int default 500)
returns table (id bigint, at timestamptz, amount_in bigint, amount_out bigint, balance bigint, payer text, unit_id text, category text, matched text, public_note text)
language sql stable security definer set search_path = public as $$
  select t.id, t.at, t.amount_in, t.amount_out, t.balance, t.payer, t.unit_id, t.category, t.matched, t.public_note
  from public.bank_tx t where public.is_admin()
  order by t.at desc, t.id desc limit least(greatest(coalesce(p_limit, 500), 1), 3000);
$$;

-- 운영진: 세대 · 구분 · 공개 메모 고치기
create or replace function public.bank_tx_set(p_id bigint, p_unit text, p_category text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '운영진만 고칠 수 있습니다' using errcode = '42501'; end if;
  if p_unit is not null and p_unit <> '' and not exists (select 1 from public.units where id = p_unit) then raise exception '없는 동·호수입니다'; end if;
  update public.bank_tx set
    unit_id = nullif(p_unit, ''),
    category = coalesce(nullif(p_category, ''), category),
    matched = 'manual',   -- 운영진이 한 번 본 거래는 '확인 필요'에서 빠진다
    public_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_id;
end $$;

create or replace function public.bank_tx_delete(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '운영진만 지울 수 있습니다' using errcode = '42501'; end if;
  delete from public.bank_tx where id = p_id;
end $$;

-- 운영진: 설정 저장
create or replace function public.dues_config_set(p_bank text, p_account text, p_holder text, p_tiers jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '운영진만 바꿀 수 있습니다' using errcode = '42501'; end if;
  if jsonb_typeof(coalesce(p_tiers, '[]')) <> 'array' or jsonb_array_length(coalesce(p_tiers, '[]')) > 12 then raise exception '금액 구간이 올바르지 않습니다'; end if;
  update public.dues_config set bank = nullif(btrim(p_bank), ''), account = nullif(btrim(p_account), ''), holder = nullif(btrim(p_holder), ''),
    tiers = coalesce(p_tiers, '[]'), updated_at = now(), updated_by = auth.uid() where id = 1;
end $$;

-- 세대별 납부 합계 (내부용)
create or replace function public.dues_by_unit()
returns table (unit_id text, paid bigint, first_at timestamptz, due bigint)
language sql stable security definer set search_path = public as $$
  select t.unit_id, sum(t.amount_in), min(t.at), public.dues_amount_at((min(t.at) at time zone 'Asia/Seoul')::date)
  from public.bank_tx t where t.category = '회비' and t.unit_id is not null
  group by t.unit_id;
$$;
revoke all on function public.dues_by_unit() from public;

-- 운영진: 세대별 납부 현황
create or replace function public.dues_units()
returns table (unit_id text, paid bigint, first_at timestamptz, due bigint)
language sql stable security definer set search_path = public as $$
  select * from public.dues_by_unit() where public.is_admin();
$$;

-- 누구나: 회비 안내(계좌 · 금액) + 납부 세대 수 + 월별 합계 + 공개 메모 지출
create or replace function public.dues_public()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'bank', c.bank, 'account', c.account, 'holder', c.holder, 'tiers', c.tiers,
    'paid_units', (select count(*) from public.dues_by_unit() d where d.paid >= coalesce(d.due, 1)),
    'months', coalesce((select jsonb_agg(jsonb_build_object('month', g.month, 'dues', g.dues, 'other', g.other, 'out', g.out, 'balance', g.balance) order by g.month desc) from (
        select to_char(t.at at time zone 'Asia/Seoul', 'YYYY-MM') as month,
          sum(case when t.category = '회비' then t.amount_in else 0 end) as dues,
          sum(case when t.category <> '회비' then t.amount_in else 0 end) as other,
          sum(t.amount_out) as out,
          (array_agg(t.balance order by t.at desc, t.id desc))[1] as balance
        from public.bank_tx t group by 1) g), '[]'::jsonb),
    'spend', coalesce((select jsonb_agg(jsonb_build_object('at', t.at, 'amount', t.amount_out, 'note', t.public_note) order by t.at desc)
        from public.bank_tx t where t.amount_out > 0 and t.public_note is not null), '[]'::jsonb),
    'updated', (select max(at) from public.bank_tx))
  from public.dues_config c where c.id = 1;
$$;

-- 회원: 우리 세대 납부 상태
create or replace function public.dues_mine()
returns table (unit_id text, paid bigint, first_at timestamptz, due bigint)
language sql stable security definer set search_path = public as $$
  select p.unit_id, coalesce(d.paid, 0), d.first_at, coalesce(d.due, public.dues_amount_at((now() at time zone 'Asia/Seoul')::date))
  from public.profiles p left join public.dues_by_unit() d on d.unit_id = p.unit_id
  where p.id = auth.uid() and p.status = 'approved';
$$;

revoke all on function public.dues_unit_from(text) from public;
revoke all on function public.dues_amount_at(date) from public;
revoke all on function public.bank_import(jsonb) from public;
revoke all on function public.bank_tx_list(int) from public;
revoke all on function public.bank_tx_set(bigint, text, text, text) from public;
revoke all on function public.bank_tx_delete(bigint) from public;
revoke all on function public.dues_config_set(text, text, text, jsonb) from public;
revoke all on function public.dues_units() from public;
revoke all on function public.dues_public() from public;
revoke all on function public.dues_mine() from public;
grant execute on function public.bank_import(jsonb) to authenticated;
grant execute on function public.bank_tx_list(int) to authenticated;
grant execute on function public.bank_tx_set(bigint, text, text, text) to authenticated;
grant execute on function public.bank_tx_delete(bigint) to authenticated;
grant execute on function public.dues_config_set(text, text, text, jsonb) to authenticated;
grant execute on function public.dues_units() to authenticated;
grant execute on function public.dues_public() to anon, authenticated;
grant execute on function public.dues_mine() to authenticated;
notify pgrst, 'reload schema';

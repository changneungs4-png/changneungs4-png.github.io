-- ════════════════════════════════════════════════════════════════
--  창릉 S-4 입주예정자협의회 — Supabase 스키마
--  Supabase 대시보드 → SQL Editor에 이 파일 전체를 붙여 넣고 Run.
--  이어서 units_seed.sql을 실행하세요.
--
--  원칙
--   · 모든 테이블 RLS 사용. 화면 코드를 조작해도 정책을 넘을 수 없습니다.
--   · 한 세대(동-호)에는 승인된 계정이 하나만 존재합니다.
--   · 위임동의 · 투표 · 민원 참여는 세대 단위로 1회입니다.
--   · 세대 · 작성자 정보는 서버가 로그인 계정에서 채웁니다(클라이언트 값 무시).
-- ════════════════════════════════════════════════════════════════

-- ── 세대 목록 (동·호수 배치표) ─────────────────────────────
create table if not exists public.units (
  id    text primary key,                 -- '403-1803'
  dong  int  not null,
  ho    int  not null,
  floor int  not null,
  line  int  not null,
  type  text not null,
  unique (dong, ho)
);

-- ── 회원 ───────────────────────────────────────────────────
do $$ begin
  create type public.member_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  username          text not null unique,                 -- 로그인 아이디 = 세대(동-호)
  nickname          text check (nickname is null or char_length(btrim(nickname)) between 2 and 20),
  unit_id           text not null unique references public.units (id),   -- 1세대 1계정
  status            public.member_status not null default 'pending',
  is_admin          boolean not null default false,
  contract_path     text,
  privacy_agreed_at timestamptz not null default now(),
  reject_reason     text,
  reviewed_at       timestamptz,
  reviewed_by       uuid,
  created_at        timestamptz not null default now()
);
-- (예전 버전의 부분 인덱스 정리)
drop index if exists public.profiles_one_approved_per_unit;
do $$ begin
  alter table public.profiles alter column nickname drop not null;
  alter table public.profiles drop constraint if exists profiles_username_check;
  alter table public.profiles drop constraint if exists profiles_nickname_check;
  alter table public.profiles add constraint profiles_nickname_check check (nickname is null or char_length(btrim(nickname)) between 2 and 20);
  if not exists (select 1 from pg_constraint where conname = 'profiles_unit_id_key') then
    alter table public.profiles add constraint profiles_unit_id_key unique (unit_id);
  end if;
exception when others then raise notice 'profiles 제약 정리: %', sqlerrm; end $$;
alter table public.profiles drop constraint if exists profiles_username_is_unit;
alter table public.profiles add constraint profiles_username_is_unit check (username = unit_id);
create index if not exists profiles_status_idx on public.profiles (status);

-- ── 권한 헬퍼 (RLS 재귀 방지를 위해 security definer) ────────
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin and p.status = 'approved' from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.my_unit() returns text
language sql stable security definer set search_path = public as $$
  select p.unit_id from public.profiles p where p.id = auth.uid() and p.status = 'approved';
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_unit() is not null;
$$;

-- 웹 요청(anon/authenticated)인지. SQL Editor(postgres)나 service_role에서는 false.
-- current_user는 security definer 함수 안에서 함수 소유자로 바뀌므로 쓰면 안 됩니다.
-- request.jwt.claims는 API 서버가 검증된 토큰으로만 설정하고, 클라이언트가 바꿀 수 없습니다.
create or replace function public.is_api_request() returns boolean
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') in ('anon', 'authenticated');
$$;

-- ── 회원 정보 보호 트리거 ───────────────────────────────────
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_api_request() then return new; end if;

  if tg_op = 'INSERT' then
    if new.id is distinct from auth.uid() then raise exception '본인 계정만 만들 수 있습니다' using errcode = '42501'; end if;
    -- 로그인 아이디(이메일 앞부분)가 곧 세대. 다른 세대로는 회원 정보를 만들 수 없음
    if split_part((select u.email from auth.users u where u.id = auth.uid()), '@', 1) is distinct from new.unit_id then
      raise exception '로그인한 세대와 가입 세대가 다릅니다' using errcode = '42501';
    end if;
    new.username := new.unit_id;
    new.status := 'pending'; new.is_admin := false;
    new.reject_reason := null; new.reviewed_at := null; new.reviewed_by := null;
    new.privacy_agreed_at := now(); new.created_at := now();
    new.nickname := nullif(btrim(coalesce(new.nickname, '')), '');
    return new;
  end if;

  -- UPDATE
  if public.is_admin() then
    if new.id is distinct from old.id or new.username is distinct from old.username or new.unit_id is distinct from old.unit_id then
      raise exception '세대(아이디)는 바꿀 수 없습니다' using errcode = '42501';
    end if;
    if new.status is distinct from old.status then
      new.reviewed_at := now(); new.reviewed_by := auth.uid();
    end if;
    return new;
  end if;

  if old.id is distinct from auth.uid() then raise exception '권한이 없습니다' using errcode = '42501'; end if;
  if new.id is distinct from old.id or new.username is distinct from old.username
     or new.is_admin is distinct from old.is_admin or new.reviewed_at is distinct from old.reviewed_at
     or new.reviewed_by is distinct from old.reviewed_by or new.created_at is distinct from old.created_at
     or new.privacy_agreed_at is distinct from old.privacy_agreed_at then
    raise exception '바꿀 수 없는 항목입니다' using errcode = '42501';
  end if;
  new.nickname := nullif(btrim(coalesce(new.nickname, '')), '');
  if new.unit_id is distinct from old.unit_id then raise exception '세대(아이디)는 바꿀 수 없습니다' using errcode = '42501'; end if;

  if old.status = 'rejected' then
    -- 반려된 회원은 계약서를 다시 내고 재신청할 수 있음
    if new.status not in ('rejected', 'pending') then raise exception '승인은 운영진만 할 수 있습니다' using errcode = '42501'; end if;
    if new.status = 'pending' then new.reject_reason := null; end if;
    return new;
  end if;

  if new.status is distinct from old.status or new.reject_reason is distinct from old.reject_reason then
    raise exception '세대 · 상태는 운영진만 바꿀 수 있습니다' using errcode = '42501';
  end if;
  if old.status = 'approved' and new.contract_path is distinct from old.contract_path then
    raise exception '승인 후에는 계약서를 바꿀 수 없습니다' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.profiles_guard();

alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_delete on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy profiles_delete on public.profiles for delete to authenticated using (public.is_admin());

-- ── 위임동의 ───────────────────────────────────────────────
create table if not exists public.agreements (
  unit_id            text primary key references public.units (id),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  signer_name        text not null check (char_length(btrim(signer_name)) between 2 and 30),
  agree_delegation   boolean not null check (agree_delegation),
  agree_privacy      boolean not null check (agree_privacy),
  agree_identity     boolean not null check (agree_identity),
  agree_third_party  boolean not null default false,
  form_version       text not null,
  signed_at          timestamptz not null default now()
);

create table if not exists public.agreement_log (
  id        bigint generated always as identity primary key,
  unit_id   text not null,
  user_id   uuid,
  action    text not null check (action in ('sign', 'withdraw')),
  at        timestamptz not null default now()
);

create or replace function public.agreements_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_api_request() then return new; end if;
  if public.my_unit() is null then raise exception '승인된 회원만 위임동의서를 낼 수 있습니다' using errcode = '42501'; end if;
  new.unit_id := public.my_unit();
  new.user_id := auth.uid();
  new.signer_name := btrim(new.signer_name);
  new.signed_at := now();
  return new;
end $$;
drop trigger if exists agreements_guard on public.agreements;
create trigger agreements_guard before insert on public.agreements for each row execute function public.agreements_guard();

create or replace function public.agreements_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then insert into public.agreement_log (unit_id, user_id, action) values (new.unit_id, new.user_id, 'sign');
  else insert into public.agreement_log (unit_id, user_id, action) values (old.unit_id, old.user_id, 'withdraw'); end if;
  return null;
end $$;
drop trigger if exists agreements_log on public.agreements;
create trigger agreements_log after insert or delete on public.agreements for each row execute function public.agreements_log();

alter table public.agreements enable row level security;
alter table public.agreement_log enable row level security;
drop policy if exists agreements_select on public.agreements;
drop policy if exists agreements_insert on public.agreements;
drop policy if exists agreements_delete on public.agreements;
drop policy if exists agreement_log_select on public.agreement_log;
create policy agreements_select on public.agreements for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy agreements_insert on public.agreements for insert to authenticated with check (public.is_member());
create policy agreements_delete on public.agreements for delete to authenticated using (user_id = auth.uid() or public.is_admin());
create policy agreement_log_select on public.agreement_log for select to authenticated using (public.is_admin());

-- 공개 집계: 동별 세대수 · 동의수 (누구나)
create or replace function public.agreement_stats()
returns table (dong int, total int, agreed int)
language sql stable security definer set search_path = public as $$
  select u.dong, count(*)::int, count(a.unit_id)::int
  from public.units u left join public.agreements a on a.unit_id = u.id
  group by u.dong order by u.dong;
$$;

-- 세대별 동의 여부: 승인된 회원 · 운영진에게만
create or replace function public.agreed_units()
returns setof text
language sql stable security definer set search_path = public as $$
  select a.unit_id from public.agreements a where public.is_member() or public.is_admin();
$$;

-- 가입 전에 세대가 이미 가입되었는지 확인 (동의 여부 등 다른 정보는 주지 않음)
create or replace function public.unit_taken(p_unit text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.unit_id = p_unit);
$$;

-- 운영진: 회원 정보 없이 계정만 남은 세대(가입 중단) 목록
create or replace function public.admin_orphan_accounts()
returns table (id uuid, unit_id text, created_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select u.id, split_part(u.email, '@', 1), u.created_at from auth.users u
  where public.is_admin() and not exists (select 1 from public.profiles p where p.id = u.id)
  order by u.created_at;
$$;

-- 운영진: 계정 삭제 (사칭 · 잘못된 세대). 세대가 풀려 실제 계약자가 가입할 수 있게 됨.
-- 계약서 파일은 화면에서 먼저 저장소 API로 지운 뒤 호출합니다.
create or replace function public.admin_delete_account(p_user uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception '운영진만 할 수 있습니다' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception '자기 계정은 삭제할 수 없습니다' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = p_user and is_admin) then raise exception '운영진 계정은 SQL Editor에서만 삭제할 수 있습니다' using errcode = '42501'; end if;
  delete from auth.users where id = p_user;
end $$;

-- ── 게시판 ─────────────────────────────────────────────────
create table if not exists public.posts (
  id           bigint generated always as identity primary key,
  cat          text not null check (cat in ('자유', '정보', '질문', '공구')),
  title        text not null check (char_length(btrim(title)) between 1 and 80),
  body         text not null check (char_length(btrim(body)) between 1 and 5000),
  author_id    uuid not null references public.profiles (id) on delete cascade,
  author_label text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);
create table if not exists public.comments (
  id           bigint generated always as identity primary key,
  post_id      bigint not null references public.posts (id) on delete cascade,
  body         text not null check (char_length(btrim(body)) between 1 and 1000),
  author_id    uuid not null references public.profiles (id) on delete cascade,
  author_label text not null,
  created_at   timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id);

-- 작성자 = 로그인 계정. 표시 이름은 "닉네임 · 403동"(호수는 노출하지 않음)
create or replace function public.authored_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  if not public.is_api_request() then return new; end if;
  if tg_op = 'INSERT' then
    select * into p from public.profiles where id = auth.uid() and status = 'approved';
    if not found then raise exception '승인된 회원만 글을 쓸 수 있습니다' using errcode = '42501'; end if;
    new.author_id := p.id;
    new.author_label := coalesce(p.nickname || ' · ', '') || split_part(p.unit_id, '-', 1) || '동' || case when p.nickname is null then ' 입주예정자' else '' end;
    new.created_at := now();
    if tg_table_name = 'posts' then new.updated_at := null; end if;
  else
    new.author_id := old.author_id; new.author_label := old.author_label; new.created_at := old.created_at;
    if tg_table_name = 'posts' then new.updated_at := now(); end if;
  end if;
  return new;
end $$;
drop trigger if exists posts_guard on public.posts;
create trigger posts_guard before insert or update on public.posts for each row execute function public.authored_guard();
drop trigger if exists comments_guard on public.comments;
create trigger comments_guard before insert on public.comments for each row execute function public.authored_guard();

alter table public.posts enable row level security;
alter table public.comments enable row level security;
drop policy if exists posts_select on public.posts;
drop policy if exists posts_insert on public.posts;
drop policy if exists posts_update on public.posts;
drop policy if exists posts_delete on public.posts;
create policy posts_select on public.posts for select to authenticated using (public.is_member() or public.is_admin());
create policy posts_insert on public.posts for insert to authenticated with check (public.is_member());
create policy posts_update on public.posts for update to authenticated using (author_id = auth.uid() and public.is_member());
create policy posts_delete on public.posts for delete to authenticated using (author_id = auth.uid() or public.is_admin());
drop policy if exists comments_select on public.comments;
drop policy if exists comments_insert on public.comments;
drop policy if exists comments_delete on public.comments;
create policy comments_select on public.comments for select to authenticated using (public.is_member() or public.is_admin());
create policy comments_insert on public.comments for insert to authenticated with check (public.is_member());
create policy comments_delete on public.comments for delete to authenticated using (author_id = auth.uid() or public.is_admin());

-- ── 투표 (1세대 1표) ───────────────────────────────────────
create table if not exists public.polls (
  id          bigint generated always as identity primary key,
  question    text not null check (char_length(btrim(question)) between 2 and 200),
  options     text[] not null check (array_length(options, 1) between 2 and 10),
  ends_at     timestamptz not null,
  created_at  timestamptz not null default now()
);
create table if not exists public.poll_votes (
  poll_id     bigint not null references public.polls (id) on delete cascade,
  unit_id     text not null references public.units (id),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  option_idx  int not null,
  voted_at    timestamptz not null default now(),
  primary key (poll_id, unit_id)
);

create or replace function public.vote_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare pl public.polls;
begin
  if not public.is_api_request() then return new; end if;
  if public.my_unit() is null then raise exception '승인된 회원만 투표할 수 있습니다' using errcode = '42501'; end if;
  select * into pl from public.polls where id = new.poll_id;
  if not found then raise exception '없는 투표입니다'; end if;
  if pl.ends_at < now() then raise exception '마감된 투표입니다' using errcode = '42501'; end if;
  if new.option_idx < 0 or new.option_idx >= array_length(pl.options, 1) then raise exception '없는 선택지입니다'; end if;
  new.unit_id := public.my_unit(); new.user_id := auth.uid(); new.voted_at := now();
  return new;
end $$;
drop trigger if exists vote_guard on public.poll_votes;
create trigger vote_guard before insert on public.poll_votes for each row execute function public.vote_guard();

alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;
drop policy if exists polls_select on public.polls;
drop policy if exists polls_admin on public.polls;
create policy polls_select on public.polls for select to authenticated using (public.is_member() or public.is_admin());
create policy polls_admin on public.polls for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists votes_select on public.poll_votes;
drop policy if exists votes_insert on public.poll_votes;
create policy votes_select on public.poll_votes for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy votes_insert on public.poll_votes for insert to authenticated with check (public.is_member());

create or replace function public.poll_results(p_poll bigint)
returns table (option_idx int, votes int)
language sql stable security definer set search_path = public as $$
  select v.option_idx, count(*)::int from public.poll_votes v
  where v.poll_id = p_poll and (public.is_member() or public.is_admin())
  group by v.option_idx;
$$;

-- ── 단체민원 (1세대 1참여) ──────────────────────────────────
create table if not exists public.campaigns (
  id           bigint generated always as identity primary key,
  title        text not null check (char_length(btrim(title)) between 2 and 120),
  target       text not null default '',
  status       text not null default '의견 모집' check (status in ('의견 모집', '접수 완료', '답변 완료')),
  description  text not null default '',
  created_at   timestamptz not null default now()
);
create table if not exists public.campaign_joins (
  campaign_id  bigint not null references public.campaigns (id) on delete cascade,
  unit_id      text not null references public.units (id),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (campaign_id, unit_id)
);

create or replace function public.join_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_api_request() then return new; end if;
  if public.my_unit() is null then raise exception '승인된 회원만 참여할 수 있습니다' using errcode = '42501'; end if;
  if not exists (select 1 from public.campaigns c where c.id = new.campaign_id and c.status = '의견 모집') then
    raise exception '의견 모집 중인 민원이 아닙니다' using errcode = '42501';
  end if;
  new.unit_id := public.my_unit(); new.user_id := auth.uid(); new.joined_at := now();
  return new;
end $$;
drop trigger if exists join_guard on public.campaign_joins;
create trigger join_guard before insert on public.campaign_joins for each row execute function public.join_guard();

alter table public.campaigns enable row level security;
alter table public.campaign_joins enable row level security;
drop policy if exists campaigns_select on public.campaigns;
drop policy if exists campaigns_admin on public.campaigns;
create policy campaigns_select on public.campaigns for select to anon, authenticated using (true);
create policy campaigns_admin on public.campaigns for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists joins_select on public.campaign_joins;
drop policy if exists joins_insert on public.campaign_joins;
create policy joins_select on public.campaign_joins for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy joins_insert on public.campaign_joins for insert to authenticated with check (public.is_member());

create or replace function public.campaign_counts()
returns table (campaign_id bigint, joined int)
language sql stable security definer set search_path = public as $$
  select j.campaign_id, count(*)::int from public.campaign_joins j group by j.campaign_id;
$$;

-- ── 세대 목록은 누구나 읽기 ─────────────────────────────────
alter table public.units enable row level security;
drop policy if exists units_select on public.units;
create policy units_select on public.units for select to anon, authenticated using (true);

-- ── 권한(grant) 정리: 필요한 것만 ───────────────────────────
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;
grant select on public.units, public.campaigns to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, delete on public.agreements to authenticated;
grant select on public.agreement_log to authenticated;
grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, delete on public.comments to authenticated;
grant select, insert, update, delete on public.polls, public.campaigns to authenticated;
grant select, insert on public.poll_votes, public.campaign_joins to authenticated;
grant execute on function public.agreement_stats(), public.campaign_counts(), public.unit_taken(text) to anon, authenticated;
grant execute on function public.agreed_units(), public.poll_results(bigint), public.is_admin(), public.is_member(), public.my_unit(), public.admin_orphan_accounts(), public.admin_delete_account(uuid) to authenticated;
grant execute on function public.is_api_request() to anon, authenticated;
-- 트리거 함수는 직접 호출 불가(위 revoke)

-- ── 계약서 저장소 (비공개 버킷) ─────────────────────────────
insert into storage.buckets (id, name, public) values ('contracts', 'contracts', false) on conflict (id) do nothing;
drop policy if exists contracts_insert on storage.objects;
drop policy if exists contracts_select on storage.objects;
drop policy if exists contracts_delete on storage.objects;
create policy contracts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'contracts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy contracts_select on storage.objects for select to authenticated
  using (bucket_id = 'contracts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy contracts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'contracts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ── 첫 운영진 지정 (가입 후 SQL Editor에서 한 번 실행) ──────
--   update public.profiles set status = 'approved', is_admin = true where unit_id = '401-101';  -- 운영진의 동-호

-- ── 자동 수집 소식 (뉴스 · LH 공고) ─────────────────────────
-- 수집기(Edge Function collect-news)가 매일 넣고, 운영진은 숨기기만 합니다.
create table if not exists public.news_items (
  id            bigint generated always as identity primary key,
  kind          text not null check (kind in ('news', 'lh')),
  topic         text not null default '',           -- 'S-4' | '창릉' | LH 공고 유형
  title         text not null check (char_length(title) between 2 and 300),
  url           text not null unique check (url ~ '^https?://'),
  source        text not null default '',
  published_at  timestamptz,
  extra         jsonb not null default '{}'::jsonb, -- LH: 상태 · 마감일 등
  hidden        boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists news_items_pub_idx on public.news_items (published_at desc nulls last);
alter table public.news_items enable row level security;
drop policy if exists news_select on public.news_items;
drop policy if exists news_admin_update on public.news_items;
create policy news_select on public.news_items for select to anon, authenticated using (not hidden or public.is_admin());
create policy news_admin_update on public.news_items for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.news_items to anon, authenticated;
grant update (hidden) on public.news_items to authenticated;
grant select, insert, update on public.news_items to service_role;
grant usage on sequence public.news_items_id_seq to service_role;
grant execute on function public.is_admin() to anon;   -- 공개 정책(news_select)에서 호출. 비로그인은 항상 false
-- 넣기는 수집기(service_role)만. 웹에서 직접 넣는 권한은 주지 않음

-- LH 공고문(PDF)에서 읽은 일정 · 주요 정보 (scripts/read-notices.mjs가 채움, 목록 수집기는 건드리지 않음)
alter table public.news_items add column if not exists parsed jsonb;
grant update (parsed) on public.news_items to service_role;

-- ─────────────────────────────────────────────
-- 가입할 때 위임동의서를 함께 받도록 변경 (2026-11-05)
-- · 승인 대기 회원도 위임동의서를 낼 수 있음 (가입 화면에서 함께 제출)
-- · 현황판 집계는 승인된 회원의 동의만 셈
-- · 위임동의서가 없는 세대는 운영진도 승인할 수 없음
-- schema.sql에도 같은 내용이 반영되어 있습니다. 이미 운영 중인 DB에만 이 파일을 실행하세요.

-- 가입(대기 · 승인)한 본인 세대
create or replace function public.my_claimed_unit() returns text
language sql stable security definer set search_path = public as $$
  select p.unit_id from public.profiles p where p.id = auth.uid() and p.status in ('pending', 'approved');
$$;
grant execute on function public.my_claimed_unit() to authenticated;

create or replace function public.agreements_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_api_request() then return new; end if;
  if public.my_claimed_unit() is null then raise exception '가입한 회원만 위임동의서를 낼 수 있습니다' using errcode = '42501'; end if;
  new.unit_id := public.my_claimed_unit();
  new.user_id := auth.uid();
  new.signer_name := btrim(new.signer_name);
  new.signed_at := now();
  return new;
end $$;

drop policy if exists agreements_insert on public.agreements;
create policy agreements_insert on public.agreements for insert to authenticated with check (public.my_claimed_unit() is not null);

-- 공개 집계: 승인된 회원의 동의만
create or replace function public.agreement_stats()
returns table (dong int, total int, agreed int)
language sql stable security definer set search_path = public as $$
  select u.dong, count(*)::int, count(p.id)::int
  from public.units u
  left join public.agreements a on a.unit_id = u.id
  left join public.profiles p on p.id = a.user_id and p.status = 'approved'
  group by u.dong order by u.dong;
$$;

create or replace function public.agreed_units()
returns setof text
language sql stable security definer set search_path = public as $$
  select a.unit_id from public.agreements a join public.profiles p on p.id = a.user_id and p.status = 'approved'
  where public.is_member() or public.is_admin();
$$;

-- 승인 조건: 위임동의서 제출
create or replace function public.profiles_require_consent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_api_request() then return new; end if;
  if new.status = 'approved' and old.status is distinct from 'approved'
     and not exists (select 1 from public.agreements a where a.user_id = new.id) then
    raise exception '위임동의서를 내지 않은 세대는 승인할 수 없습니다' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists profiles_require_consent on public.profiles;
create trigger profiles_require_consent before update on public.profiles
  for each row execute function public.profiles_require_consent();

-- 위임동의서에서 계약자 성명을 받지 않음 (개인정보 최소 수집, 2026-11-05)
-- 위임은 세대 단위: 계약서 사진으로 운영진이 확인한 계정 = 그 세대
-- 이미 받은 성명은 지웁니다. (2026-11-05-consent-at-signup.sql 다음에 실행)
alter table public.agreements alter column signer_name drop not null;
alter table public.agreements drop constraint if exists agreements_signer_name_check;
update public.agreements set signer_name = null where signer_name is not null;

create or replace function public.agreements_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_api_request() then return new; end if;
  if public.my_claimed_unit() is null then raise exception '가입한 회원만 위임동의서를 낼 수 있습니다' using errcode = '42501'; end if;
  new.unit_id := public.my_claimed_unit();
  new.user_id := auth.uid();
  new.signer_name := null;      -- 성명은 받지 않음
  new.signed_at := now();
  return new;
end $$;

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

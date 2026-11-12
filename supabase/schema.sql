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

-- 위임 철회 = 회원 이용 중지, 가입 · 승인 이력 기록 (2026-11-06)

-- 1) 회원(게시판 · 투표 · 민원 · 세대별 현황) = 승인 + 위임동의. 운영진은 예외
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'approved'
      and (p.is_admin or exists (select 1 from public.agreements a where a.user_id = p.id))
  );
$$;

-- 게시판 · 댓글 · 투표 · 민원 참여 정책은 모두 is_member()를 쓰므로 함께 적용됩니다.

-- 2) 위임 제출 · 철회 기록에 처리한 사람(본인 또는 운영진) 추가
alter table public.agreement_log add column if not exists by_user uuid;
create or replace function public.agreements_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then insert into public.agreement_log (unit_id, user_id, action, by_user) values (new.unit_id, new.user_id, 'sign', auth.uid());
  else insert into public.agreement_log (unit_id, user_id, action, by_user) values (old.unit_id, old.user_id, 'withdraw', auth.uid()); end if;
  return null;
end $$;

-- 3) 가입 · 승인 · 반려 · 승인 취소 · 운영진 지정 · 계정 삭제 이력 (지우지 않고 쌓기만 함)
create table if not exists public.member_log (
  id          bigint generated always as identity primary key,
  profile_id  uuid,
  unit_id     text not null,
  action      text not null check (action in ('signup', 'approve', 'reject', 'reapply', 'revoke', 'admin_on', 'admin_off', 'delete')),
  note        text,
  by_user     uuid,
  at          timestamptz not null default now()
);
alter table public.member_log enable row level security;
drop policy if exists member_log_select on public.member_log;
create policy member_log_select on public.member_log for select to authenticated using (public.is_admin());
revoke all on public.member_log from anon, authenticated;
grant select on public.member_log to authenticated;

create or replace function public.profiles_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare a text;
begin
  if tg_op = 'INSERT' then
    insert into public.member_log (profile_id, unit_id, action, by_user) values (new.id, new.unit_id, 'signup', auth.uid());
    return null;
  end if;
  if tg_op = 'DELETE' then
    insert into public.member_log (profile_id, unit_id, action, by_user) values (old.id, old.unit_id, 'delete', auth.uid());
    return null;
  end if;
  if new.status is distinct from old.status then
    a := case
      when new.status = 'approved' then 'approve'
      when old.status = 'approved' then 'revoke'
      when new.status = 'rejected' then 'reject'
      when old.status = 'rejected' and new.status = 'pending' then 'reapply'
    end;
    if a is not null then
      insert into public.member_log (profile_id, unit_id, action, note, by_user)
      values (new.id, new.unit_id, a, case when a in ('reject', 'revoke') then new.reject_reason end, auth.uid());
    end if;
  end if;
  if new.is_admin is distinct from old.is_admin then
    insert into public.member_log (profile_id, unit_id, action, by_user) values (new.id, new.unit_id, case when new.is_admin then 'admin_on' else 'admin_off' end, auth.uid());
  end if;
  return null;
end $$;
drop trigger if exists profiles_log on public.profiles;
create trigger profiles_log after insert or update or delete on public.profiles
  for each row execute function public.profiles_log();

-- 지금까지의 가입 · 승인은 남아 있는 날짜로 한 번 채워 둠
insert into public.member_log (profile_id, unit_id, action, at)
select p.id, p.unit_id, 'signup', p.created_at from public.profiles p
where not exists (select 1 from public.member_log m where m.profile_id = p.id and m.action = 'signup');
insert into public.member_log (profile_id, unit_id, action, by_user, at)
select p.id, p.unit_id, 'approve', p.reviewed_by, coalesce(p.reviewed_at, p.created_at) from public.profiles p
where p.status = 'approved' and not exists (select 1 from public.member_log m where m.profile_id = p.id and m.action = 'approve');

notify pgrst, 'reload schema';

-- 위임장 서명 · 연락처(선택) · 서면 접수 (2026-11-06)
-- 온라인: 계약자 성명 + 화면 서명(필수), 연락처(선택 동의). 서버가 일시와 문서 해시를 기록
-- 서면: 공식 메일로 받은 위임장을 운영진이 스캔본과 함께 등록 (계정 없는 세대도 집계)
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.agreements alter column user_id drop not null;
alter table public.agreements add column if not exists signature     text;
alter table public.agreements add column if not exists phone         text;
alter table public.agreements add column if not exists agree_contact boolean not null default false;
alter table public.agreements add column if not exists source        text not null default 'online';
alter table public.agreements add column if not exists paper_path    text;
alter table public.agreements add column if not exists entered_by    uuid;
alter table public.agreements add column if not exists doc_hash      text;

alter table public.agreements drop constraint if exists agreements_source_chk;
alter table public.agreements add constraint agreements_source_chk check (source in ('online', 'paper'));
alter table public.agreements drop constraint if exists agreements_signature_chk;
alter table public.agreements add constraint agreements_signature_chk
  check (signature is null or (signature like 'data:image/png;base64,%' and char_length(signature) between 200 and 300000));
alter table public.agreements drop constraint if exists agreements_phone_chk;
alter table public.agreements add constraint agreements_phone_chk
  check (phone is null or (agree_contact and phone ~ '^01[016789]-?[0-9]{3,4}-?[0-9]{4}$'));
alter table public.agreements drop constraint if exists agreements_kind_chk;
alter table public.agreements add constraint agreements_kind_chk check (
  (source = 'online' and user_id is not null)
  or (source = 'paper' and user_id is null and paper_path is not null and signer_name is not null)
) not valid;

create or replace function public.agreements_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare pp text;
begin
  if not public.is_api_request() then return new; end if;
  new.signed_at := coalesce(case when new.source = 'paper' then new.signed_at end, now());
  if new.source = 'paper' then
    -- 서면 위임장: 운영진만 등록
    if not public.is_admin() then raise exception '서면 위임장은 운영진만 등록할 수 있습니다' using errcode = '42501'; end if;
    if not exists (select 1 from public.units where id = new.unit_id) then raise exception '없는 세대입니다' using errcode = '22023'; end if;
    new.user_id := null; new.signature := null; new.entered_by := auth.uid();
    new.signer_name := btrim(new.signer_name);
    if new.signer_name is null or char_length(new.signer_name) not between 2 and 30 then raise exception '서면 위임장의 계약자 성명을 입력하세요' using errcode = '22023'; end if;
    if new.paper_path is null then raise exception '서면 위임장 스캔본을 첨부하세요' using errcode = '22023'; end if;
  else
    if public.my_claimed_unit() is null then raise exception '가입한 회원만 위임동의서를 낼 수 있습니다' using errcode = '42501'; end if;
    new.source := 'online';
    new.unit_id := public.my_claimed_unit();
    new.user_id := auth.uid(); new.entered_by := auth.uid(); new.paper_path := null;
    new.signer_name := btrim(new.signer_name);
    if new.signer_name is null or char_length(new.signer_name) not between 2 and 30 then raise exception '계약자 성명을 입력하세요' using errcode = '22023'; end if;
    if new.signature is null then raise exception '위임장에 서명해 주세요' using errcode = '22023'; end if;
    if now() < public.consent_open_at() then
      raise exception '위임장은 공급계약이 시작되는 % 부터 제출할 수 있습니다', to_char(public.consent_open_at() at time zone 'Asia/Seoul', 'FMMM"월" FMDD"일"') using errcode = '42501';
    end if;
    -- 이 세대의 서면 위임장이 먼저 있으면, 그 스캔본을 이어받고 온라인 위임으로 바꿈
    select a.paper_path into pp from public.agreements a where a.unit_id = new.unit_id and a.source = 'paper';
    if found then delete from public.agreements a where a.unit_id = new.unit_id and a.source = 'paper'; new.paper_path := pp; end if;
  end if;
  if not new.agree_contact then new.phone := null; end if;
  new.phone := nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'), '');
  if new.phone is not null then new.phone := regexp_replace(new.phone, '^(01[016789])([0-9]{3,4})([0-9]{4})$', '\1-\2-\3'); end if;
  -- 위임장 문서 지문: 양식 · 세대 · 성명 · 일시 · 동의 항목 · 서명(또는 스캔본)을 묶은 SHA-256
  new.doc_hash := encode(digest(concat_ws('|', new.form_version, new.unit_id, new.signer_name,
      to_char(new.signed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      new.agree_delegation::text, new.agree_privacy::text, new.agree_identity::text, new.agree_third_party::text, new.agree_contact::text,
      coalesce(new.phone, ''), coalesce(encode(digest(new.signature, 'sha256'), 'hex'), new.paper_path, '')), 'sha256'), 'hex');
  return new;
end $$;

-- 현황 집계: 승인된 회원의 온라인 위임 + 운영진이 등록한 서면 위임
create or replace function public.agreement_stats()
returns table (dong int, total int, agreed int)
language sql stable security definer set search_path = public as $$
  select u.dong, count(*)::int, count(a.unit_id) filter (where a.source = 'paper' or p.id is not null)::int
  from public.units u
  left join public.agreements a on a.unit_id = u.id
  left join public.profiles p on p.id = a.user_id and p.status = 'approved'
  group by u.dong order by u.dong;
$$;
create or replace function public.agreed_units()
returns setof text
language sql stable security definer set search_path = public as $$
  select a.unit_id from public.agreements a left join public.profiles p on p.id = a.user_id and p.status = 'approved'
  where (a.source = 'paper' or p.id is not null) and (public.is_member() or public.is_admin());
$$;

-- 서면 위임장 스캔본: 비공개, 운영진만
insert into storage.buckets (id, name, public) values ('consents', 'consents', false)
on conflict (id) do update set public = false;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit') then
    execute $q$update storage.buckets set file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] where id = 'consents'$q$;
  end if;
end $$;
drop policy if exists consents_admin_select on storage.objects;
drop policy if exists consents_admin_insert on storage.objects;
drop policy if exists consents_admin_delete on storage.objects;
create policy consents_admin_select on storage.objects for select to authenticated using (bucket_id = 'consents' and public.is_admin());
create policy consents_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'consents' and public.is_admin());
create policy consents_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'consents' and public.is_admin());

-- 위임이 지워지면(철회 · 계정 삭제 · 승인 취소) 서면 스캔본을 지울 목록에 올림 → 알림 작업(30분마다)이 저장소에서 삭제
create table if not exists public.file_cleanup (
  bucket text not null, path text not null, queued_at timestamptz not null default now(),
  primary key (bucket, path)
);
alter table public.file_cleanup enable row level security;
revoke all on public.file_cleanup from anon, authenticated;
grant select, delete on public.file_cleanup to service_role;
grant select (paper_path) on public.agreements to service_role;   -- 정리할 때 아직 쓰는 파일인지 확인
create or replace function public.agreements_queue_file() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.paper_path is not null and not exists (select 1 from public.agreements a where a.paper_path = old.paper_path) then
    insert into public.file_cleanup (bucket, path) values ('consents', old.paper_path) on conflict do nothing;
  end if;
  return null;
end $$;
drop trigger if exists agreements_queue_file on public.agreements;
create trigger agreements_queue_file after delete on public.agreements for each row execute function public.agreements_queue_file();

notify pgrst, 'reload schema';

-- 가입과 위임 분리 (2026-11-06)
-- · 가입 승인: 계약서 사진. 위임장 없이도 승인됨
-- · 가입 · 위임장: 공급계약(2026-11-16~) 시작부터
-- · 가입 회원: 게시판 읽기 · 쓰기 · 댓글, 투표 결과 보기
-- · 위임 회원(위임장 제출 세대): + 투표 · 민원 참여, 세대별 위임 현황
-- (2026-11-06-withdraw-and-logs.sql, 2026-11-06b-signature-paper.sql 다음에 실행)

-- 가입 · 위임장 제출 시작 시각 (바꾸려면 SQL Editor에서 app_settings 값만 수정)
create table if not exists public.app_settings (key text primary key, value text not null);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
insert into public.app_settings (key, value) values ('consent_open_at', '2026-11-16 00:00:00+09') on conflict (key) do nothing;
create or replace function public.consent_open_at() returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce((select value::timestamptz from public.app_settings where key = 'consent_open_at'), timestamptz '2026-11-16 00:00:00+09');
$$;
grant execute on function public.consent_open_at() to anon, authenticated;

-- 가입도 공급계약 시작부터 (계약 포기 세대가 섞이지 않게)
create or replace function public.profiles_open_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_api_request() then return new; end if;
  if now() < public.consent_open_at() then
    raise exception '가입은 공급계약이 시작되는 % 부터 받습니다', to_char(public.consent_open_at() at time zone 'Asia/Seoul', 'FMMM"월" FMDD"일"') using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists profiles_open_guard on public.profiles;
create trigger profiles_open_guard before insert on public.profiles for each row execute function public.profiles_open_guard();

-- 가입 회원 = 승인된 세대
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_unit() is not null;
$$;
-- 위임 회원 = 승인 + 위임장 (운영진은 예외)
create or replace function public.is_delegate() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'approved'
      and (p.is_admin or exists (select 1 from public.agreements a where a.user_id = p.id))
  );
$$;
grant execute on function public.is_delegate() to authenticated;

-- 승인에 위임장 필요 없음
drop trigger if exists profiles_require_consent on public.profiles;
drop function if exists public.profiles_require_consent();

-- 투표 · 민원 참여 = 위임 회원
create or replace function public.vote_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare pl public.polls;
begin
  if not public.is_api_request() then return new; end if;
  if public.my_unit() is null then raise exception '승인된 회원만 투표할 수 있습니다' using errcode = '42501'; end if;
  if not public.is_delegate() then raise exception '위임장을 낸 세대만 투표할 수 있습니다' using errcode = '42501'; end if;
  select * into pl from public.polls where id = new.poll_id;
  if not found then raise exception '없는 투표입니다'; end if;
  if pl.ends_at < now() then raise exception '마감된 투표입니다' using errcode = '42501'; end if;
  if new.option_idx < 0 or new.option_idx >= array_length(pl.options, 1) then raise exception '없는 선택지입니다'; end if;
  new.unit_id := public.my_unit(); new.user_id := auth.uid(); new.voted_at := now();
  return new;
end $$;
create or replace function public.join_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_api_request() then return new; end if;
  if public.my_unit() is null then raise exception '승인된 회원만 참여할 수 있습니다' using errcode = '42501'; end if;
  if not public.is_delegate() then raise exception '위임장을 낸 세대만 민원에 참여할 수 있습니다' using errcode = '42501'; end if;
  if not exists (select 1 from public.campaigns c where c.id = new.campaign_id and c.status = '의견 모집') then
    raise exception '의견 모집 중인 민원이 아닙니다' using errcode = '42501';
  end if;
  new.unit_id := public.my_unit(); new.user_id := auth.uid(); new.joined_at := now();
  return new;
end $$;
drop policy if exists votes_insert on public.poll_votes;
create policy votes_insert on public.poll_votes for insert to authenticated with check (public.is_delegate());
drop policy if exists joins_insert on public.campaign_joins;
create policy joins_insert on public.campaign_joins for insert to authenticated with check (public.is_delegate());

-- 세대별 위임 현황(어느 호수가 위임했는지) = 위임 회원 · 운영진
create or replace function public.agreed_units()
returns setof text
language sql stable security definer set search_path = public as $$
  select a.unit_id from public.agreements a left join public.profiles p on p.id = a.user_id and p.status = 'approved'
  where (a.source = 'paper' or p.id is not null) and (public.is_delegate() or public.is_admin());
$$;

notify pgrst, 'reload schema';

-- 사진관 · 현장 방문 기록 (2026-11-06)
-- 보기: 누구나 / 올리기 · 수정 · 삭제: 운영진
-- 사진은 올릴 때 브라우저에서 줄이고(긴 변 1600px JPEG) 위치 정보(EXIF)를 지운 뒤 공개 저장소 'gallery'에 저장

create table if not exists public.visits (
  id          bigint generated always as identity primary key,
  visited_on  date not null,
  title       text not null check (char_length(btrim(title)) between 2 and 120),
  body        text not null default '' check (char_length(body) <= 5000),
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create table if not exists public.photos (
  id          bigint generated always as identity primary key,
  cat         text not null default '기타' check (cat in ('현장 방문', '공사 현장', '모델하우스', '행사', '기타')),
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  taken_on    date,
  path        text not null unique check (path ~ '^[0-9]{4}/[A-Za-z0-9._-]+\.(jpg|jpeg|webp|png)$'),
  width       int,
  height      int,
  visit_id    bigint references public.visits (id) on delete cascade,
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists photos_visit_idx on public.photos (visit_id);

create or replace function public.author_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_api_request() then return new; end if;
  if tg_op = 'INSERT' then new.created_by := auth.uid(); new.created_at := now();
  else new.created_by := old.created_by; new.created_at := old.created_at; end if;
  new.title := btrim(new.title);
  return new;
end $$;
drop trigger if exists visits_stamp on public.visits;
create trigger visits_stamp before insert or update on public.visits for each row execute function public.author_stamp();
drop trigger if exists photos_stamp on public.photos;
create trigger photos_stamp before insert or update on public.photos for each row execute function public.author_stamp();

alter table public.visits enable row level security;
alter table public.photos enable row level security;
revoke all on public.visits, public.photos from anon, authenticated;
grant select on public.visits, public.photos to anon, authenticated;
grant insert, update, delete on public.visits, public.photos to authenticated;
drop policy if exists visits_select on public.visits;
drop policy if exists visits_admin on public.visits;
drop policy if exists photos_select on public.photos;
drop policy if exists photos_admin on public.photos;
create policy visits_select on public.visits for select to anon, authenticated using (true);
create policy visits_admin  on public.visits for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy photos_select on public.photos for select to anon, authenticated using (true);
create policy photos_admin  on public.photos for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 공개 저장소: 누구나 보기, 운영진만 올리기 · 지우기
insert into storage.buckets (id, name, public) values ('gallery', 'gallery', true)
on conflict (id) do update set public = true;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit') then
    execute $q$update storage.buckets set file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/webp', 'image/png'] where id = 'gallery'$q$;
  end if;
end $$;
drop policy if exists gallery_admin_insert on storage.objects;
drop policy if exists gallery_admin_delete on storage.objects;
drop policy if exists gallery_admin_select on storage.objects;
create policy gallery_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'gallery' and public.is_admin());
create policy gallery_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'gallery' and public.is_admin());
create policy gallery_admin_select on storage.objects for select to authenticated using (bucket_id = 'gallery' and public.is_admin());

-- 사진 기록이 지워지면(방문 기록 삭제 포함) 파일을 지울 목록에 올림 → 알림 작업(30분마다)이 저장소에서 삭제
create or replace function public.photos_queue_file() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.file_cleanup (bucket, path) values ('gallery', old.path) on conflict do nothing;
  return null;
end $$;
drop trigger if exists photos_queue_file on public.photos;
create trigger photos_queue_file after delete on public.photos for each row execute function public.photos_queue_file();
grant select (path) on public.photos to service_role;

notify pgrst, 'reload schema';

-- 게시판 · 댓글 작성자 표시를 "동"에서 "동-호"로 (2026-11-10)
-- 예: 403-1804, 닉네임이 있으면 "닉네임 · 403-1804"
create or replace function public.authored_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  if not public.is_api_request() then return new; end if;
  if tg_op = 'INSERT' then
    select * into p from public.profiles where id = auth.uid() and status = 'approved';
    if not found then raise exception '승인된 회원만 글을 쓸 수 있습니다' using errcode = '42501'; end if;
    new.author_id := p.id;
    new.author_label := coalesce(p.nickname || ' · ', '') || p.unit_id;
    new.created_at := now();
    if tg_table_name = 'posts' then new.updated_at := null; end if;
  else
    new.author_id := old.author_id; new.author_label := old.author_label; new.created_at := old.created_at;
    if tg_table_name = 'posts' then new.updated_at := now(); end if;
  end if;
  return new;
end $$;

-- 이미 쓴 글 · 댓글도 같은 형식으로
update public.posts t set author_label = coalesce(p.nickname || ' · ', '') || p.unit_id from public.profiles p where p.id = t.author_id;
update public.comments t set author_label = coalesce(p.nickname || ' · ', '') || p.unit_id from public.profiles p where p.id = t.author_id;

-- 동별 가입(승인) 세대 수 공개 집계 (2026-11-10)
-- 위임동의 현황판 · 첫 화면에 "가입 ○세대 (위임 전 ○세대)"를 함께 보여주기 위함. 세대 번호는 내보내지 않음
create or replace function public.member_stats()
returns table (dong int, members int)
language sql stable security definer set search_path = public as $$
  select split_part(p.unit_id, '-', 1)::int, count(*)::int
  from public.profiles p
  where p.status = 'approved' and p.unit_id ~ '^[0-9]+-[0-9]+$'
  group by 1 order by 1;
$$;
revoke all on function public.member_stats() from public;
grant execute on function public.member_stats() to anon, authenticated;
notify pgrst, 'reload schema';

-- 가입(승인)했지만 위임 전인 세대를 현황판에 다른 색으로 (2026-11-10)
-- 세대 번호는 위임 회원 · 운영진에게만 (agreed_units와 같은 범위)
create or replace function public.member_units()
returns setof text
language sql stable security definer set search_path = public as $$
  select p.unit_id from public.profiles p
  where p.status = 'approved' and (public.is_delegate() or public.is_admin());
$$;
revoke all on function public.member_units() from public;
grant execute on function public.member_units() to authenticated;
notify pgrst, 'reload schema';

-- 입주민 비밀 오픈채팅방: 입장 주소 · 비밀번호를 위임 세대에게만 (2026-11-10)
create table if not exists public.chat_info (
  id          int primary key default 1 check (id = 1),
  url         text check (url is null or url ~ '^https://'),
  password    text check (password is null or char_length(password) between 1 and 40),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
alter table public.chat_info enable row level security;
revoke all on public.chat_info from anon, authenticated;
insert into public.chat_info (id) values (1) on conflict do nothing;

-- 위임 회원 · 운영진만 읽기
create or replace function public.chat_info_get()
returns table (url text, password text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.url, c.password, c.updated_at from public.chat_info c
  where c.id = 1 and (public.is_delegate() or public.is_admin());
$$;
revoke all on function public.chat_info_get() from public;
grant execute on function public.chat_info_get() to authenticated;

-- 운영진만 바꾸기
create or replace function public.chat_info_set(p_url text, p_password text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '운영진만 바꿀 수 있습니다' using errcode = '42501'; end if;
  update public.chat_info set url = nullif(btrim(p_url), ''), password = nullif(btrim(p_password), ''), updated_at = now(), updated_by = auth.uid() where id = 1;
end $$;
revoke all on function public.chat_info_set(text, text) from public;
grant execute on function public.chat_info_set(text, text) to authenticated;
notify pgrst, 'reload schema';

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

-- 위임동의서 v6 (2026-11-12): 준비위원회 「입예협 구성 및 위임 동의서」 반영
-- 추가 항목: 카페 닉네임(선택), 공동명의자 성명 · 서명(공동명의자가 직접 서명할 때만)
-- 휴대전화번호는 v6부터 수집 항목(필수)이라 온라인 제출에서 반드시 받는다.

alter table public.agreements add column if not exists cafe_nick    text;
alter table public.agreements add column if not exists co_name      text;
alter table public.agreements add column if not exists co_signature text;

alter table public.agreements drop constraint if exists agreements_cafe_nick_chk;
alter table public.agreements add constraint agreements_cafe_nick_chk check (cafe_nick is null or char_length(cafe_nick) between 1 and 30);
alter table public.agreements drop constraint if exists agreements_co_chk;
alter table public.agreements add constraint agreements_co_chk check (
  (co_name is null and co_signature is null)
  or (char_length(co_name) between 2 and 30 and co_signature like 'data:image/png;base64,%' and char_length(co_signature) between 200 and 300000));

-- 기존 agreements_guard 다음에 실행 (트리거는 이름 순서): 새 항목 정리 · 검사 후 문서 지문에 함께 묶음
create or replace function public.agreements_guard_v6() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_api_request() then return new; end if;
  new.cafe_nick := nullif(btrim(coalesce(new.cafe_nick, '')), '');
  new.co_name := nullif(btrim(coalesce(new.co_name, '')), '');
  if new.source = 'paper' then
    new.co_signature := null; new.co_name := null;
  else
    if new.co_signature is null then new.co_name := null; end if;
    if new.co_signature is not null and (new.co_name is null or char_length(new.co_name) not between 2 and 30) then
      raise exception '공동명의자 성명을 입력하세요' using errcode = '22023';
    end if;
    if new.form_version like '2026-11-v6%' and new.phone is null then
      raise exception '휴대전화번호를 입력하세요' using errcode = '22023';
    end if;
  end if;
  new.doc_hash := encode(digest(concat_ws('|', new.doc_hash, coalesce(new.cafe_nick, ''), coalesce(new.co_name, ''),
      coalesce(encode(digest(new.co_signature, 'sha256'), 'hex'), '')), 'sha256'), 'hex');
  return new;
end $$;
drop trigger if exists agreements_guard_v6 on public.agreements;
create trigger agreements_guard_v6 before insert on public.agreements for each row execute function public.agreements_guard_v6();
notify pgrst, 'reload schema';
-- 카페 등업 (2026-11-12)
-- 카페는 소통, 계약자 확인은 홈페이지. 승인 회원이 카페 닉네임을 남기면 운영진이 이 목록을 보고 등업한다.
-- 계약서 사진을 카페에서 다시 받지 않는다. 전화번호는 여기서 다루지 않는다(위임장에서만).

alter table public.profiles add column if not exists cafe_nick text;
alter table public.profiles drop constraint if exists profiles_cafe_nick_chk;
alter table public.profiles add constraint profiles_cafe_nick_chk check (cafe_nick is null or char_length(cafe_nick) between 1 and 30);

-- 회원 본인: 카페 닉네임 저장 (비우면 지움)
create or replace function public.set_my_cafe_nick(p_nick text)
returns void language plpgsql security definer set search_path = public as $$
declare v text := nullif(btrim(coalesce(p_nick, '')), '');
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다' using errcode = '42501'; end if;
  if v is not null and char_length(v) > 30 then raise exception '카페 닉네임은 30자까지입니다' using errcode = '22023'; end if;
  update public.profiles set cafe_nick = v where id = auth.uid();
end $$;

-- 등업 처리 기록 (세대 기준)
create table if not exists public.cafe_grades (
  unit_id    text primary key references public.units (id),
  state      text not null check (state in ('up', 'down')),
  cafe_nick  text check (cafe_nick is null or char_length(cafe_nick) <= 30),   -- 처리할 때의 닉네임 (나중에 바뀌면 다시 확인)
  at         timestamptz not null default now(),
  by_user    uuid
);
alter table public.cafe_grades enable row level security;
revoke all on public.cafe_grades from anon, authenticated;

-- 운영진: 등업 대상 목록
--   status: 회원 상태(없으면 계정 없음), agreed: 위임 여부, nick: 위임장 > 내 정보 순서의 카페 닉네임
create or replace function public.cafe_list()
returns table (unit_id text, status text, agreed boolean, nick text, state text, marked_nick text, marked_at timestamptz)
language sql stable security definer set search_path = public as $$
  with m as (
    select p.unit_id, p.status, p.cafe_nick as pnick from public.profiles p where p.unit_id is not null
  ), a as (
    select ag.unit_id, ag.cafe_nick as anick from public.agreements ag
    left join public.profiles pp on pp.id = ag.user_id
    where ag.source = 'paper' or pp.status = 'approved'
  ), u as (
    select unit_id from m union select unit_id from a union select unit_id from public.cafe_grades
  )
  select u.unit_id, m.status, (a.unit_id is not null), coalesce(a.anick, m.pnick), g.state, g.cafe_nick, g.at
  from u left join m on m.unit_id = u.unit_id left join a on a.unit_id = u.unit_id left join public.cafe_grades g on g.unit_id = u.unit_id
  where public.is_admin()
  order by u.unit_id;
$$;

-- 운영진: 등업함 / 내림 / 기록 지움
create or replace function public.cafe_mark(p_unit text, p_state text)
returns void language plpgsql security definer set search_path = public as $$
declare v_nick text;
begin
  if not public.is_admin() then raise exception '운영진만 처리할 수 있습니다' using errcode = '42501'; end if;
  if p_state is null or p_state = '' then delete from public.cafe_grades where unit_id = p_unit; return; end if;
  if p_state not in ('up', 'down') then raise exception '잘못된 처리입니다' using errcode = '22023'; end if;
  select l.nick into v_nick from public.cafe_list() l where l.unit_id = p_unit;
  insert into public.cafe_grades (unit_id, state, cafe_nick, at, by_user) values (p_unit, p_state, v_nick, now(), auth.uid())
  on conflict (unit_id) do update set state = excluded.state, cafe_nick = excluded.cafe_nick, at = excluded.at, by_user = excluded.by_user;
end $$;

revoke all on function public.set_my_cafe_nick(text) from public;
revoke all on function public.cafe_list() from public;
revoke all on function public.cafe_mark(text, text) from public;
grant execute on function public.set_my_cafe_nick(text) to authenticated;
grant execute on function public.cafe_list() to authenticated;
grant execute on function public.cafe_mark(text, text) to authenticated;
notify pgrst, 'reload schema';

-- 가입 시작 시각을 위임동의 시작 시각과 따로 (2026-11-12)
-- 회장단이 먼저 가입해 운영진 권한을 받을 수 있게 가입은 지금 열고, 위임동의서는 그대로 공급계약 시작(11.16)부터.
-- 미리 가입한 계정은 '대기'로 남고, 운영진이 승인한 세대만 이용할 수 있다.

insert into public.app_settings (key, value) values ('signup_open_at', '2026-11-12 15:00:00+09')
on conflict (key) do update set value = excluded.value;

create or replace function public.signup_open_at() returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce((select value::timestamptz from public.app_settings where key = 'signup_open_at'), public.consent_open_at());
$$;
grant execute on function public.signup_open_at() to anon, authenticated;

create or replace function public.profiles_open_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_api_request() then return new; end if;
  if now() < public.signup_open_at() then
    raise exception '가입은 % 부터 받습니다', to_char(public.signup_open_at() at time zone 'Asia/Seoul', 'FMMM"월" FMDD"일"') using errcode = '42501';
  end if;
  return new;
end $$;
notify pgrst, 'reload schema';

-- 최고 관리자 (2026-11-12)
-- 운영진 지정 · 해제는 최고 관리자만. 최고 관리자 계정의 승인 · 운영진 권한 · 위임은 다른 운영진이 바꿀 수 없다.
-- 최고 관리자를 바꾸려면 SQL Editor에서 owner_unit 값을 바꾼다.

insert into public.app_settings (key, value) values ('owner_unit', '403-1804')
on conflict (key) do nothing;

create or replace function public.owner_id() returns uuid
language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p where p.unit_id = (select value from public.app_settings where key = 'owner_unit') limit 1;
$$;
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and auth.uid() = public.owner_id();
$$;
create or replace function public.owner_unit() returns text
language sql stable security definer set search_path = public as $$
  select value from public.app_settings where key = 'owner_unit';
$$;
revoke all on function public.owner_id() from public;
grant execute on function public.is_owner(), public.owner_unit() to authenticated;

-- 기존 profiles_guard 다음에 실행 (이름 순서)
create or replace function public.profiles_guard_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare o uuid := public.owner_id();
begin
  if not public.is_api_request() or tg_op <> 'UPDATE' then return new; end if;
  if o is not null and old.id = o then
    if auth.uid() is distinct from o and (new.is_admin is distinct from old.is_admin or new.status is distinct from old.status or new.reject_reason is distinct from old.reject_reason) then
      raise exception '최고 관리자 계정은 다른 운영진이 바꿀 수 없습니다' using errcode = '42501';
    end if;
    if not new.is_admin or new.status <> 'approved' then
      raise exception '최고 관리자의 운영진 권한 · 승인은 해제할 수 없습니다' using errcode = '42501';
    end if;
  end if;
  if new.is_admin is distinct from old.is_admin and o is not null and auth.uid() is distinct from o then
    raise exception '운영진 지정 · 해제는 최고 관리자만 할 수 있습니다' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_owner on public.profiles;
create trigger profiles_guard_owner before update on public.profiles for each row execute function public.profiles_guard_owner();

-- 최고 관리자의 위임동의서는 본인만 철회
create or replace function public.agreements_owner_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_api_request() and old.user_id is not null and old.user_id = public.owner_id() and auth.uid() is distinct from old.user_id then
    raise exception '최고 관리자의 위임동의는 본인만 철회할 수 있습니다' using errcode = '42501';
  end if;
  return old;
end $$;
drop trigger if exists agreements_owner_guard on public.agreements;
create trigger agreements_owner_guard before delete on public.agreements for each row execute function public.agreements_owner_guard();

-- 계정 삭제: 운영진 · 최고 관리자 계정은 화면에서 지울 수 없음 (기존과 같음, 최고 관리자도 명시)
create or replace function public.admin_delete_account(p_user uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception '운영진만 할 수 있습니다' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception '자기 계정은 삭제할 수 없습니다' using errcode = '42501'; end if;
  if p_user = public.owner_id() then raise exception '최고 관리자 계정은 삭제할 수 없습니다' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = p_user and is_admin) then raise exception '운영진 계정은 SQL Editor에서만 삭제할 수 있습니다' using errcode = '42501'; end if;
  delete from auth.users where id = p_user;
end $$;
notify pgrst, 'reload schema';

-- 게시판 작성자는 동-호만 (2026-11-12)
-- 닉네임을 쓰면 어느 세대인지 확인이 안 되므로 작성자 표시는 "403-1804"처럼 동-호수만.
-- 카페 닉네임은 위임동의서에서만 받는다(내 정보 입력 칸 없음).

create or replace function public.authored_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  if not public.is_api_request() then return new; end if;
  if tg_op = 'INSERT' then
    select * into p from public.profiles where id = auth.uid() and status = 'approved';
    if not found then raise exception '승인된 회원만 글을 쓸 수 있습니다' using errcode = '42501'; end if;
    new.author_id := p.id;
    new.author_label := p.unit_id;
    new.created_at := now();
    if tg_table_name = 'posts' then new.updated_at := null; end if;
  else
    new.author_id := old.author_id; new.author_label := old.author_label; new.created_at := old.created_at;
    if tg_table_name = 'posts' then new.updated_at := now(); end if;
  end if;
  return new;
end $$;

-- 이미 쓴 글 · 댓글도 동-호만
update public.posts t set author_label = p.unit_id from public.profiles p where p.id = t.author_id;
update public.comments t set author_label = p.unit_id from public.profiles p where p.id = t.author_id;
-- 그동안 저장된 게시판 닉네임 · 내 정보 카페 닉네임은 지움 (위임동의서의 카페 닉네임은 그대로)
update public.profiles set nickname = null where nickname is not null;
update public.profiles set cafe_nick = null where cafe_nick is not null;

-- 확정 동의서(v7) 반영 (2026-11-12)
-- 공동명의 세대의 대표 회원 성명 추가. 휴대전화 필수는 v6 이후 모든 온라인 양식에 적용. 카페 닉네임은 받지 않음.
alter table public.agreements add column if not exists rep_name text;
alter table public.agreements drop constraint if exists agreements_rep_chk;
alter table public.agreements add constraint agreements_rep_chk check (rep_name is null or char_length(rep_name) between 2 and 30);

create or replace function public.agreements_guard_v6() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_api_request() then return new; end if;
  new.cafe_nick := nullif(btrim(coalesce(new.cafe_nick, '')), '');
  new.co_name := nullif(btrim(coalesce(new.co_name, '')), '');
  new.rep_name := nullif(btrim(coalesce(new.rep_name, '')), '');
  if new.source = 'paper' then
    new.co_signature := null; new.co_name := null; new.rep_name := null;
  else
    if new.co_signature is null then new.co_name := null; new.rep_name := null; end if;
    if new.co_signature is not null and (new.co_name is null or char_length(new.co_name) not between 2 and 30) then
      raise exception '공동명의자 성명을 입력하세요' using errcode = '22023';
    end if;
    if new.co_signature is not null and new.form_version >= '2026-11-v7' and (new.rep_name is null or new.rep_name not in (new.signer_name, new.co_name)) then
      raise exception '대표 회원은 계약자나 공동명의자 중 한 명이어야 합니다' using errcode = '22023';
    end if;
    if new.form_version >= '2026-11-v6' and new.form_version < '2026-11-w' and new.phone is null then
      raise exception '휴대전화번호를 입력하세요' using errcode = '22023';
    end if;
  end if;
  new.doc_hash := encode(digest(concat_ws('|', new.doc_hash, coalesce(new.cafe_nick, ''), coalesce(new.co_name, ''),
      coalesce(encode(digest(new.co_signature, 'sha256'), 'hex'), ''), coalesce(new.rep_name, '')), 'sha256'), 'hex');
  return new;
end $$;
notify pgrst, 'reload schema';

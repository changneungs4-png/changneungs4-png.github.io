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

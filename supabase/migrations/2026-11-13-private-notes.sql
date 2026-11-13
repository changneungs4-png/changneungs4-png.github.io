-- 회원 전용 안내문 (2026-11-13)
-- 외부 유출 금지 내용(안건 정보 · 정치인 연락처 등)은 공개 파일(data.js)에 두지 않고 여기 저장한다.
-- 승인 회원만 읽고, 운영진만 고친다.

create table if not exists public.private_notes (
  key        text primary key check (key ~ '^[a-z0-9-]{2,40}$'),
  body       text not null default '' check (char_length(body) <= 5000),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.private_notes enable row level security;
revoke all on public.private_notes from anon, authenticated;

create or replace function public.private_note_get(p_key text)
returns table (body text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select n.body, n.updated_at from public.private_notes n where n.key = p_key and public.is_member();
$$;

create or replace function public.private_note_set(p_key text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '운영진만 고칠 수 있습니다' using errcode = '42501'; end if;
  insert into public.private_notes (key, body, updated_at, updated_by) values (p_key, coalesce(p_body, ''), now(), auth.uid())
  on conflict (key) do update set body = excluded.body, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
end $$;

revoke all on function public.private_note_get(text) from public;
revoke all on function public.private_note_set(text, text) from public;
grant execute on function public.private_note_get(text) to authenticated;
grant execute on function public.private_note_set(text, text) to authenticated;
notify pgrst, 'reload schema';

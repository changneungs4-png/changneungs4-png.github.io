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

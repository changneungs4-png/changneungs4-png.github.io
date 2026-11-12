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

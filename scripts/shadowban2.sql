-- シャドウの人の行動は通知も出さない（相手に気づかれない）
create or replace function public.notify_feed_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t text; rawid uuid; owner uuid;
begin
  if is_shadowed(new.user_id) then return new; end if;
  t := split_part(new.item_key, ':', 1);
  begin
    rawid := split_part(new.item_key, ':', 2)::uuid;
  exception when others then
    return new;
  end;
  if t = 'board' then
    select user_id into owner from board_messages where id = rawid;
  elsif t = 'offer' then
    select user_id into owner from offers where id = rawid;
  end if;
  if owner is not null and owner <> new.user_id then
    insert into notifications(user_id, actor_id, kind, target_url, excerpt)
    values (owner, new.user_id, 'comment', '/post/' || t || '/' || rawid::text, left(new.body, 120));
  end if;
  return new;
end $$;

create or replace function public.on_goods_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner uuid; nm text; slots int; acc int;
begin
  if is_shadowed(new.user_id) then return new; end if;
  select o.user_id, o.slots into owner, slots from offers o where o.id = new.offer_id;
  if tg_op = 'INSERT' then
    select display_name into nm from profiles where id = new.user_id;
    insert into notifications(user_id, actor_id, kind, target_url, excerpt)
    values (owner, new.user_id, 'goods_request', '/post/offer/' || new.offer_id::text,
            coalesce(nm,'参加者') || 'さんが「受け取りたい」と希望しています' || coalesce('：' || left(new.message, 80), ''));
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status <> 'accepted' then
    insert into friendships (requester, addressee, status, responded_at)
    values (owner, new.user_id, 'accepted', now())
    on conflict (requester, addressee) do update set status = 'accepted', responded_at = now();
    select display_name into nm from profiles where id = owner;
    insert into notifications(user_id, actor_id, kind, target_url, excerpt)
    values (new.user_id, owner, 'goods_accept', '/u/' || owner::text,
            coalesce(nm,'参加者') || 'さんがあなたに決めました。TalKで受け渡しの相談をしてください');
    select count(*) into acc from goods_requests where offer_id = new.offer_id and status = 'accepted';
    if acc >= slots then
      update offers set done = true, done_at = now() where id = new.offer_id and done = false;
    end if;
  end if;
  return new;
end $$;

create or replace function public.on_voice_support()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner uuid; nm text;
begin
  if is_shadowed(new.user_id) then return new; end if;
  select b.user_id into owner from board_messages b where b.id = new.message_id;
  if tg_op = 'INSERT' and new.status = 'accepted' then
    insert into friendships (requester, addressee, status, responded_at)
    values (new.user_id, owner, 'accepted', now())
    on conflict (requester, addressee) do update set status = 'accepted', responded_at = now();
    select display_name into nm from profiles where id = new.user_id;
    insert into notifications(user_id, actor_id, kind, target_url, excerpt)
    values (owner, new.user_id, 'voice_support', '/post/board/' || new.message_id::text,
            coalesce(nm,'参加者') || 'さんが「私が応援します」と手を挙げました。TalKで送り先などを相談してください' || coalesce('：' || left(new.message, 80), ''));
  elsif tg_op = 'INSERT' then
    select display_name into nm from profiles where id = new.user_id;
    insert into notifications(user_id, actor_id, kind, target_url, excerpt)
    values (owner, new.user_id, 'voice_support', '/post/board/' || new.message_id::text,
            coalesce(nm,'参加者') || 'さんが「私が応援します」と手を挙げました' || coalesce('：' || left(new.message, 80), ''));
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status <> 'accepted' then
    insert into friendships (requester, addressee, status, responded_at)
    values (owner, new.user_id, 'accepted', now())
    on conflict (requester, addressee) do update set status = 'accepted', responded_at = now();
    select display_name into nm from profiles where id = owner;
    insert into notifications(user_id, actor_id, kind, target_url, excerpt)
    values (new.user_id, owner, 'voice_accept', '/u/' || owner::text,
            coalesce(nm,'参加者') || 'さんがあなたに応援をお願いしました。TalKで送り先などを相談してください');
  elsif tg_op = 'UPDATE' and new.status = 'declined' and old.status = 'accepted' then
    select display_name into nm from profiles where id = owner;
    insert into notifications(user_id, actor_id, kind, target_url, excerpt)
    values (new.user_id, owner, 'voice_release', '/post/board/' || new.message_id::text,
            coalesce(nm,'参加者') || 'さんの「助けて」は、今回は別の方に応援を求めることになりました');
  end if;
  return new;
end $$;

-- 助けての「私が応援します」で、シャドウの人が押しても「現在やり取り中」にならないように（他人からは存在しない扱い）
drop policy if exists "vsup insert self" on public.voice_supports;
create policy "vsup insert self" on public.voice_supports for insert
with check (
  auth.uid() = user_id and jwt_not_anonymous()
  and exists (select 1 from public.board_messages b where b.id = voice_supports.message_id and b.user_id <> auth.uid()
              and b.scope = 'voice' and coalesce(b.status,'open') <> 'done')
  and not exists (select 1 from public.voice_supports v where v.message_id = voice_supports.message_id and v.status in ('pending','accepted') and visible_author(v.user_id))
);

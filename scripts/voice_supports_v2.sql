-- 助けて: 「私が応援します」を押した瞬間に成立（1人だけ）→ 現在やり取り中。決裂したら投稿主が「違う人に応援を求める」で解除
drop policy if exists "vsup insert self" on public.voice_supports;
create policy "vsup insert self" on public.voice_supports for insert
with check (
  auth.uid() = user_id and jwt_not_anonymous()
  and exists (select 1 from public.board_messages b where b.id = voice_supports.message_id and b.user_id <> auth.uid()
              and b.scope = 'voice' and coalesce(b.status,'open') <> 'done')
  and not exists (select 1 from public.voice_supports v where v.message_id = voice_supports.message_id and v.status in ('pending','accepted'))
);

create or replace function public.on_voice_support()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner uuid; nm text;
begin
  select b.user_id into owner from board_messages b where b.id = new.message_id;
  if tg_op = 'INSERT' and new.status = 'accepted' then
    -- 押した瞬間に成立: 友達承認してTalKできるように + 投稿主へ🔔
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
    -- 決裂: 応援者に🔔
    select display_name into nm from profiles where id = owner;
    insert into notifications(user_id, actor_id, kind, target_url, excerpt)
    values (new.user_id, owner, 'voice_release', '/post/board/' || new.message_id::text,
            coalesce(nm,'参加者') || 'さんの「助けて」は、今回は別の方に応援を求めることになりました');
  end if;
  return new;
end $$;

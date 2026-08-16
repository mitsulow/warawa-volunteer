-- 事務局ボット(2b9f33c9-…)のTalKを管理者が読み書きできるようにする（事務局の受信箱）
-- + 未読合計RPCに「管理者なら事務局受信箱の未読(相手からの分)」を加える

create or replace function public.office_bot_id() returns uuid
language sql immutable as $$ select '2b9f33c9-9ad1-4b39-bb1f-8dc7a225fbbf'::uuid $$;

-- chats: 参加者 or (管理者 かつ 事務局ボットのチャット)
drop policy if exists "chats read mine" on public.chats;
create policy "chats read mine" on public.chats for select
using (auth.uid() = a or auth.uid() = b or (is_admin(auth.uid()) and (a = office_bot_id() or b = office_bot_id())));

drop policy if exists "chats update mine" on public.chats;
create policy "chats update mine" on public.chats for update
using (auth.uid() = a or auth.uid() = b or (is_admin(auth.uid()) and (a = office_bot_id() or b = office_bot_id())));

-- messages
drop policy if exists "messages read mine" on public.messages;
create policy "messages read mine" on public.messages for select
using (exists (select 1 from public.chats c where c.id = messages.chat_id
  and (c.a = auth.uid() or c.b = auth.uid() or (is_admin(auth.uid()) and (c.a = office_bot_id() or c.b = office_bot_id())))));

drop policy if exists "messages update mine" on public.messages;
create policy "messages update mine" on public.messages for update
using (exists (select 1 from public.chats c where c.id = messages.chat_id
  and (c.a = auth.uid() or c.b = auth.uid() or (is_admin(auth.uid()) and (c.a = office_bot_id() or c.b = office_bot_id())))));

drop policy if exists "messages insert mine" on public.messages;
create policy "messages insert mine" on public.messages for insert
with check (
  (sender_id = auth.uid() and exists (select 1 from public.chats c where c.id = messages.chat_id and (c.a = auth.uid() or c.b = auth.uid())))
  or
  (sender_id = office_bot_id() and is_admin(auth.uid()) and exists (select 1 from public.chats c where c.id = messages.chat_id and (c.a = office_bot_id() or c.b = office_bot_id())))
);

drop policy if exists "messages delete own" on public.messages;
create policy "messages delete own" on public.messages for delete
using (auth.uid() = sender_id or (sender_id = office_bot_id() and is_admin(auth.uid())));

-- 未読合計: 自分のDM未読 + (管理者なら)事務局受信箱の未読(相手からの分・自分が参加者でないチャット) + 掲示板 + お知らせ
create or replace function public.unread_total(uid uuid)
returns integer
language sql stable security definer
as $$
  select
    (select count(*) from messages m
       join chats c on c.id = m.chat_id
      where m.read_at is null and m.sender_id <> uid
        and (c.a = uid or c.b = uid))::int
  + (case when exists(select 1 from admins where user_id = uid) then
      (select count(*) from messages m
         join chats c on c.id = m.chat_id
        where m.read_at is null and m.sender_id <> office_bot_id()
          and (c.a = office_bot_id() or c.b = office_bot_id())
          and c.a <> uid and c.b <> uid)
     else 0 end)::int
  + (select count(*) from board_messages b
      where b.user_id <> uid and b.scope = 'board'
        and b.created_at > coalesce(
          (select gr.last_read_at from group_reads gr
            where gr.user_id = uid and gr.scope = b.scope),
          '1970-01-01'::timestamptz))::int
  + (select count(*) from broadcasts bc
      where coalesce(bc.sender, uid) <> uid
        and bc.created_at > coalesce(
          (select br.last_read_at from broadcast_reads br where br.user_id = uid),
          '1970-01-01'::timestamptz))::int
$$;

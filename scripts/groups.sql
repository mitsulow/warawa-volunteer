-- グループTalK（LINEグループ相当）。kind='schedule' のグループは日程調整をトップに固定表示
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  kind text not null default 'normal' check (kind in ('normal','schedule')),
  schedule_id uuid references public.schedules(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  body text not null default '',
  image_url text,
  system boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists group_messages_group_created on public.group_messages(group_id, created_at);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

create or replace function public.is_group_member(gid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members m where m.group_id = gid and m.user_id = uid)
$$;

-- groups: メンバー or 管理者が読める。作成/更新は管理者
drop policy if exists "groups read member" on public.groups;
create policy "groups read member" on public.groups for select using (is_group_member(id, auth.uid()) or is_admin(auth.uid()));
drop policy if exists "groups write admin" on public.groups;
create policy "groups write admin" on public.groups for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- members: 同じグループのメンバー or 管理者が読める。追加は管理者/オーナー、自分は退出できる。last_read_at は本人が更新
drop policy if exists "gm read" on public.group_members;
create policy "gm read" on public.group_members for select using (is_group_member(group_id, auth.uid()) or is_admin(auth.uid()));
drop policy if exists "gm insert admin" on public.group_members;
create policy "gm insert admin" on public.group_members for insert
with check (is_admin(auth.uid()) or exists (select 1 from group_members o where o.group_id = group_members.group_id and o.user_id = auth.uid() and o.role = 'owner'));
drop policy if exists "gm update self" on public.group_members;
create policy "gm update self" on public.group_members for update using (auth.uid() = user_id or is_admin(auth.uid()));
drop policy if exists "gm delete self" on public.group_members;
create policy "gm delete self" on public.group_members for delete using (auth.uid() = user_id or is_admin(auth.uid()));

-- messages: メンバーが読み書き。削除は本人 or 管理者。BAN/シャドウは書けない
drop policy if exists "gmsg read" on public.group_messages;
create policy "gmsg read" on public.group_messages for select using (is_group_member(group_id, auth.uid()) or is_admin(auth.uid()));
drop policy if exists "gmsg insert member" on public.group_messages;
create policy "gmsg insert member" on public.group_messages for insert
with check (auth.uid() = sender_id and jwt_not_anonymous() and not is_banned(auth.uid()) and not is_shadowed(auth.uid()) and (is_group_member(group_id, auth.uid()) or is_admin(auth.uid())));
drop policy if exists "gmsg delete own" on public.group_messages;
create policy "gmsg delete own" on public.group_messages for delete using (auth.uid() = sender_id or is_admin(auth.uid()));

-- 未読合計にグループ分を加算
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
  + (select count(*) from group_messages gm
       join group_members me on me.group_id = gm.group_id and me.user_id = uid
      where gm.created_at > me.last_read_at and coalesce(gm.sender_id, uid) <> uid)::int
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

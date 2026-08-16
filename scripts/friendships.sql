-- 友達申請: 承認された者同士だけ 1対1 TalK を始められる。事務局ボット・管理者は例外（誰とでも）
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references public.profiles(id) on delete cascade,
  addressee uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester, addressee),
  check (requester <> addressee)
);
alter table public.friendships enable row level security;

drop policy if exists "friend read mine" on public.friendships;
create policy "friend read mine" on public.friendships for select
using (auth.uid() = requester or auth.uid() = addressee or is_admin(auth.uid()));

drop policy if exists "friend insert mine" on public.friendships;
create policy "friend insert mine" on public.friendships for insert
with check (auth.uid() = requester and jwt_not_anonymous());

drop policy if exists "friend update addressee" on public.friendships;
create policy "friend update addressee" on public.friendships for update
using (auth.uid() = addressee);

drop policy if exists "friend delete mine" on public.friendships;
create policy "friend delete mine" on public.friendships for delete
using (auth.uid() = requester or auth.uid() = addressee);

-- 承認済みか（双方向）
create or replace function public.are_friends(u1 uuid, u2 uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.requester = u1 and f.addressee = u2) or (f.requester = u2 and f.addressee = u1))
  )
$$;

-- TalKを始められるか: 事務局ボット / 管理者 が絡めば常にOK、それ以外は友達承認済みのみ
create or replace function public.can_talk(u1 uuid, u2 uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select u1 = office_bot_id() or u2 = office_bot_id()
      or is_admin(u1) or is_admin(u2)
      or are_friends(u1, u2)
$$;

-- chats の作成に can_talk を要求（既存チャットはそのまま）
drop policy if exists "chats insert mine" on public.chats;
create policy "chats insert mine" on public.chats for insert
with check ((auth.uid() = a or auth.uid() = b) and can_talk(a, b));

-- 申請/承認の🔔通知
create or replace function public.notify_friendship()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n text;
begin
  if tg_op = 'INSERT' then
    select display_name into n from profiles where id = new.requester;
    insert into notifications(user_id, actor_id, kind, target_url, excerpt)
    values (new.addressee, new.requester, 'friend_request', '/u/' || new.requester::text, coalesce(n,'参加者') || 'さんから友達申請が届きました。承認するとTalKができます');
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status <> 'accepted' then
    select display_name into n from profiles where id = new.addressee;
    insert into notifications(user_id, actor_id, kind, target_url, excerpt)
    values (new.requester, new.addressee, 'friend_accept', '/u/' || new.addressee::text, coalesce(n,'参加者') || 'さんが友達申請を承認しました。TalKで連絡できます');
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_friendship on public.friendships;
create trigger trg_notify_friendship after insert or update on public.friendships
for each row execute function public.notify_friendship();

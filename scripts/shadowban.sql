-- 見えないモード（シャドウBAN）: 本人には普通に使えて見えるが、他の人からはその人の投稿/コメント/いいね/希望が一切見えない。TalKは始められない。
alter table public.profiles add column if not exists shadow_at timestamptz;
alter table public.profiles add column if not exists shadow_reason text;

create or replace function public.is_shadowed(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = uid and p.shadow_at is not null)
$$;

-- 見えるかどうか: 投稿者がシャドウでない / 見ているのが本人 / 管理者
create or replace function public.visible_author(author uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (not is_shadowed(author)) or auth.uid() = author or is_admin(auth.uid())
$$;

drop policy if exists "board read all" on public.board_messages;
create policy "board read all" on public.board_messages for select using (visible_author(user_id));

drop policy if exists "offers read all" on public.offers;
create policy "offers read all" on public.offers for select using (visible_author(user_id));

drop policy if exists "comments read all" on public.feed_comments;
create policy "comments read all" on public.feed_comments for select using (visible_author(user_id));

drop policy if exists "likes read all" on public.feed_likes;
create policy "likes read all" on public.feed_likes for select using (visible_author(user_id));

-- 希望/応援も、シャドウの人の分は投稿主にも見せない（本人だけ）
drop policy if exists "greq read" on public.goods_requests;
create policy "greq read" on public.goods_requests for select
using (
  auth.uid() = user_id
  or (visible_author(user_id) and (is_admin(auth.uid()) or exists (select 1 from public.offers o where o.id = goods_requests.offer_id and o.user_id = auth.uid())))
);
drop policy if exists "vsup read" on public.voice_supports;
create policy "vsup read" on public.voice_supports for select
using (
  auth.uid() = user_id
  or (visible_author(user_id) and (is_admin(auth.uid()) or exists (select 1 from public.board_messages b where b.id = voice_supports.message_id and b.user_id = auth.uid())))
);

-- TalK: シャドウの人は部屋を作れない・送れない（本人には「友達申請が必要」のように見えるだけ）
create or replace function public.can_talk(u1 uuid, u2 uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (not is_shadowed(u1)) and (
      u1 = office_bot_id() or u2 = office_bot_id()
      or is_admin(u1)
      or are_friends(u1, u2))
$$;
drop policy if exists "no shadow insert messages" on public.messages;
create policy "no shadow insert messages" on public.messages as restrictive for insert with check (not is_shadowed(auth.uid()));
drop policy if exists "no shadow insert friendships" on public.friendships;
create policy "no shadow insert friendships" on public.friendships as restrictive for insert with check (not is_shadowed(auth.uid()));

-- 集計RPCもシャドウ分を除外
create or replace function public.goods_request_counts(ids uuid[])
returns table(offer_id uuid, pending int, accepted int)
language sql stable security definer set search_path = public as $$
  select r.offer_id,
         count(*) filter (where r.status = 'pending')::int,
         count(*) filter (where r.status = 'accepted')::int
  from goods_requests r where r.offer_id = any(ids) and visible_author(r.user_id) group by r.offer_id
$$;
create or replace function public.voice_support_counts(ids uuid[])
returns table(message_id uuid, pending int, accepted int)
language sql stable security definer set search_path = public as $$
  select v.message_id,
         count(*) filter (where v.status = 'pending')::int,
         count(*) filter (where v.status = 'accepted')::int
  from voice_supports v where v.message_id = any(ids) and visible_author(v.user_id) group by v.message_id
$$;

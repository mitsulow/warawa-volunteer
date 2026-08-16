-- ユーザーの書き込み禁止（BAN）。閲覧はできるが、あらゆる書き込みがRLSで弾かれる
alter table public.profiles add column if not exists banned_at timestamptz;
alter table public.profiles add column if not exists banned_reason text;

create or replace function public.is_banned(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = uid and p.banned_at is not null)
$$;

-- 管理者は profiles の banned_at/banned_reason を更新できる（本人のRLSはそのまま）
drop policy if exists "profiles update admin" on public.profiles;
create policy "profiles update admin" on public.profiles for update
using (is_admin(auth.uid()));

-- 書き込み系テーブルに restrictive で「BANされていない」を要求
do $$
declare t text;
begin
  foreach t in array array['board_messages','offers','feed_comments','feed_likes','messages','chats','friendships',
                          'goods_requests','voice_supports','bug_reports','post_reports','push_subscriptions']
  loop
    execute format('drop policy if exists "no banned insert %1$s" on public.%1$I', t);
    execute format('create policy "no banned insert %1$s" on public.%1$I as restrictive for insert with check (not is_banned(auth.uid()))', t);
    execute format('drop policy if exists "no banned update %1$s" on public.%1$I', t);
    execute format('create policy "no banned update %1$s" on public.%1$I as restrictive for update using (not is_banned(auth.uid()))', t);
  end loop;
end $$;

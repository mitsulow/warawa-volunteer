-- 助けて(voice)への「私が応援します」。投稿主が応援者を選ぶ→友達承認→TalK→届いたら投稿主が「応援完了」(board_messages.status='done')
create table if not exists public.voice_supports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.board_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (message_id, user_id)
);
alter table public.voice_supports enable row level security;

drop policy if exists "vsup read" on public.voice_supports;
create policy "vsup read" on public.voice_supports for select
using (
  auth.uid() = user_id
  or is_admin(auth.uid())
  or exists (select 1 from public.board_messages b where b.id = voice_supports.message_id and b.user_id = auth.uid())
);
drop policy if exists "vsup insert self" on public.voice_supports;
create policy "vsup insert self" on public.voice_supports for insert
with check (
  auth.uid() = user_id and jwt_not_anonymous()
  and exists (select 1 from public.board_messages b where b.id = voice_supports.message_id and b.user_id <> auth.uid()
              and b.scope = 'voice' and coalesce(b.status,'open') <> 'done')
);
drop policy if exists "vsup update owner" on public.voice_supports;
create policy "vsup update owner" on public.voice_supports for update
using (is_admin(auth.uid()) or exists (select 1 from public.board_messages b where b.id = voice_supports.message_id and b.user_id = auth.uid()));
drop policy if exists "vsup delete self" on public.voice_supports;
create policy "vsup delete self" on public.voice_supports for delete
using (auth.uid() = user_id or is_admin(auth.uid()));

create or replace function public.voice_support_counts(ids uuid[])
returns table(message_id uuid, pending int, accepted int)
language sql stable security definer set search_path = public as $$
  select v.message_id,
         count(*) filter (where v.status = 'pending')::int,
         count(*) filter (where v.status = 'accepted')::int
  from voice_supports v where v.message_id = any(ids) group by v.message_id
$$;

create or replace function public.on_voice_support()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner uuid; nm text;
begin
  select b.user_id into owner from board_messages b where b.id = new.message_id;
  if tg_op = 'INSERT' then
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
  end if;
  return new;
end $$;
drop trigger if exists trg_on_voice_support on public.voice_supports;
create trigger trg_on_voice_support after insert or update on public.voice_supports
for each row execute function public.on_voice_support();

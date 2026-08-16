-- 物資の届け方: orange=オレンジ軍団に託す(事務局経由・炊き出し場所へ) / direct=個人的に支援(欲しい人と直接) / both=両方可
alter table public.offers add column if not exists route text not null default 'orange' check (route in ('orange','direct','both'));
alter table public.offers add column if not exists slots int not null default 1 check (slots between 1 and 999);   -- 送り先は何か所(何人)まで（送料は送り手負担のため）
alter table public.offers add column if not exists quantity text;  -- 数量(自由記述: 例「カップラーメン10個」「米5kg」)
alter table public.offers add column if not exists done boolean not null default false;                            -- 応援完了(SOLD OUT相当)
alter table public.offers add column if not exists done_at timestamptz;

-- 個人的に支援の「受け取り希望」（楽市楽座のブツブツ交換の提案に相当）
create table if not exists public.goods_requests (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (offer_id, user_id)
);
alter table public.goods_requests enable row level security;

drop policy if exists "greq read" on public.goods_requests;
create policy "greq read" on public.goods_requests for select
using (
  auth.uid() = user_id
  or is_admin(auth.uid())
  or exists (select 1 from public.offers o where o.id = goods_requests.offer_id and o.user_id = auth.uid())
);
drop policy if exists "greq insert self" on public.goods_requests;
create policy "greq insert self" on public.goods_requests for insert
with check (
  auth.uid() = user_id and jwt_not_anonymous()
  and exists (select 1 from public.offers o where o.id = goods_requests.offer_id and o.user_id <> auth.uid()
              and o.route in ('direct','both') and o.done = false)
);
drop policy if exists "greq update owner" on public.goods_requests;
create policy "greq update owner" on public.goods_requests for update
using (is_admin(auth.uid()) or exists (select 1 from public.offers o where o.id = goods_requests.offer_id and o.user_id = auth.uid()));
drop policy if exists "greq delete self" on public.goods_requests;
create policy "greq delete self" on public.goods_requests for delete
using (auth.uid() = user_id or is_admin(auth.uid()));

-- 希望者数(公開用): 誰でも件数だけ見られる
create or replace function public.goods_request_counts(ids uuid[])
returns table(offer_id uuid, pending int, accepted int)
language sql stable security definer set search_path = public as $$
  select r.offer_id,
         count(*) filter (where r.status = 'pending')::int,
         count(*) filter (where r.status = 'accepted')::int
  from goods_requests r where r.offer_id = any(ids) group by r.offer_id
$$;

-- 通知 + 決定時に友達承認(TalKできるように) + 枠が埋まったら応援完了
create or replace function public.on_goods_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner uuid; nm text; slots int; acc int;
begin
  select o.user_id, o.slots into owner, slots from offers o where o.id = new.offer_id;
  if tg_op = 'INSERT' then
    select display_name into nm from profiles where id = new.user_id;
    insert into notifications(user_id, actor_id, kind, target_url, excerpt)
    values (owner, new.user_id, 'goods_request', '/post/offer/' || new.offer_id::text,
            coalesce(nm,'参加者') || 'さんが「受け取りたい」と希望しています' || coalesce('：' || left(new.message, 80), ''));
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status <> 'accepted' then
    -- 決定 = お互い了承 → 友達承認済みにしてTalKを開けるようにする
    insert into friendships (requester, addressee, status, responded_at)
    values (owner, new.user_id, 'accepted', now())
    on conflict (requester, addressee) do update set status = 'accepted', responded_at = now();
    select display_name into nm from profiles where id = owner;
    insert into notifications(user_id, actor_id, kind, target_url, excerpt)
    values (new.user_id, owner, 'goods_accept', '/u/' || owner::text,
            coalesce(nm,'参加者') || 'さんがあなたに決めました。TalKで受け渡しの相談をしてください');
    -- 枠が埋まったら応援完了
    select count(*) into acc from goods_requests where offer_id = new.offer_id and status = 'accepted';
    if acc >= slots then
      update offers set done = true, done_at = now() where id = new.offer_id and done = false;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_on_goods_request on public.goods_requests;
create trigger trg_on_goods_request after insert or update on public.goods_requests
for each row execute function public.on_goods_request();

-- 事務局の自動コメント: 届け方で文面を変える
create or replace function public.office_auto_comment_goods()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  poster text;
  msg text;
  office constant uuid := '2b9f33c9-9ad1-4b39-bb1f-8dc7a225fbbf';
begin
  select display_name into poster from public.profiles where id = new.user_id;
  poster := coalesce(nullif(poster, ''), '参加者');
  if new.kind = 'goods' then
    if new.route = 'direct' then
      return new; -- 個人的に支援だけの投稿には事務局コメントを付けない（事務局を通す場合のみ）
    elsif new.route = 'both' then
      msg := poster || 'さん、とても素敵な物資の投稿ありがとうございます。現地からのニーズをお聞きし、現地が必要だと判断された場合は事務局からTalkにてご連絡差し上げます。個人で受け取りを希望する方が現れた場合は、希望者一覧から「この人に決めた」を押すとTalKで相談できます。';
    else
      msg := poster || 'さん、とても素敵な物資の投稿ありがとうございます。現地からのニーズをお聞きし、現地が必要だと判断された場合はTalkにてご連絡差し上げますので、その際は記載された住所への送付をよろしくお願い致します。';
    end if;
  elsif new.kind = 'body' then
    msg := poster || 'さん、現地への参加の意思表示ありがとうございます。現地のニーズと事務局による審査を経て、採用された場合はTalKにてメッセージを送りますのでよろしくお願い致します。';
  elsif new.kind = 'money' then
    msg := poster || 'さん、寄付への参加表明ありがとうございます。現時点では「意思表明」のみで、寄付は完了しておりません。ボランティア口座番号についてはTalKにて送信しておりますので、そちらからご自身にてお振込みをお願い致します。';
  else
    return new;
  end if;
  insert into public.feed_comments (item_key, user_id, body)
  values ('offer:' || new.id, office, msg);
  return new;
end;
$$;

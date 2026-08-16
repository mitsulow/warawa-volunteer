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
    msg := poster || 'さん、とても素敵な物資の投稿ありがとうございます。現地からのニーズをお聞きし、現地が必要だと判断された場合はTalkにてご連絡差し上げますので、その際は記載された住所への送付をよろしくお願い致します。';
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
drop trigger if exists trg_office_auto_comment_goods on public.offers;
create trigger trg_office_auto_comment_goods
after insert on public.offers
for each row execute function public.office_auto_comment_goods();

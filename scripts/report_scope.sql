-- 現地報告 scope='report' 追加 (2026-09-01)
-- board_messages.scope に 'report' を許可し、report への投稿/更新は
-- オレンジ軍団(現地入り body offer confirmed) か管理者のみに restrictive で制限する。
-- 適用は scripts/dbpg.py で1文ずつ（pg8000は複文不可）。

alter table board_messages drop constraint board_messages_scope_check;

alter table board_messages add constraint board_messages_scope_check
  check (scope = any (array['board'::text, 'voice'::text, 'report'::text]));

create policy "report insert orange or admin" on board_messages
  as restrictive for insert
  with check (
    scope <> 'report'
    or is_admin(auth.uid())
    or exists (
      select 1 from offers o
      where o.user_id = auth.uid() and o.kind = 'body' and o.status = 'confirmed'
    )
  );

create policy "report update orange or admin" on board_messages
  as restrictive for update
  using (true)
  with check (
    scope <> 'report'
    or is_admin(auth.uid())
    or exists (
      select 1 from offers o
      where o.user_id = auth.uid() and o.kind = 'body' and o.status = 'confirmed'
    )
  );

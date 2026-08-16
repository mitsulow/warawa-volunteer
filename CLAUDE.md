# わらわ〜ボランティア — 引き継ぎ書（CLAUDE.md）

熊本地震支援サイト。本番 https://warawa-volunteer.vercel.app / repo mitsulow/warawa-volunteer。
solo dev・main直push OK。**実ユーザーが既に投稿中**（No.4 さやか@埼玉さん等）なので本番を壊さないこと。
最終更新: 2026-08-15

## 0. デプロイの型（毎リクエストこれで完結・確認不要）

```
編集 → npm run build（成功を確認してから！）→ git add -A && git commit && git push
→ GitHub連携でVercelが自動デプロイ（vercelコマンド不要・何もしなくていい）
```

- **buildが失敗してもpushされる事故**: `npm run build | tail` はパイプで終了コードが消える。ビルド出力に `Compiled` / エラーが無いか目視してからpush（2026-08-15にビルド失敗のままpushして本番デプロイを1回落とした）
- デプロイ確認: Vercel MCP `list_deployments`（projectId `prj_iFkKnhYcsK361qH2VT3nkEy342kv` / teamId `team_WQcaNkuo35Ibfo38iajEdD5f`）で state:READY を見る。見た目の確認はChromeで本番を開いてスクショ
- 反映待ちは `sleep 75〜90` をバックグラウンドで（Vercelビルドは約60-80秒）

## 1. 鍵とDB操作

- Supabaseプロジェクト: `dmixilrcxiofanwfhxfq`（東京・わらわ〜専用）。**OneSeaの `hpgofjkxqguzgrptchqj` は絶対に触らない**
- anon/service鍵・VAPID・DBパスワード: `~/.warawa-env` / Management APIトークン: `~/.rakuichi-env` の `SUPABASE_ACCESS_TOKEN`
- DB操作は Management API `/v1/projects/dmixilrcxiofanwfhxfq/database/query` に POST。**User-Agentヘッダ必須**（無いとCloudflare 403 code 1010）。**1リクエスト=1トランザクション**
- Vercel env設定済み: VAPID_PRIVATE_KEY / SUPABASE_SERVICE_ROLE_KEY

## 2. 作業の地雷（今日も踏んだやつ）

- **bashヒアドキュメントにバッククォート入りコードを書くと壊れる**（JSXテンプレートリテラル等）→ **scratchpadに.pyをWriteして実行**が鉄則
- 複数行import文の直後に自動でimportを差し込むと構文崩壊する（broadcastページで実際に発生）→ 差し込みは最終行のimportの後か手動Edit
- supabase auth コールバックは型注釈必須: `({ data }: { data: { session: Session | null } })` 形式にしないとビルドが落ちる
- **オーバーレイUI（ドロワー/モーダル/ライトボックス）は必ず `createPortal(..., document.body)`**。backdrop-blur付きヘッダー等の中に置くとfixedが閉じ込められて見えなくなる（☰で実際に発生・OneSeaでも複数回）
- Tailwind 4 は translateクラスが `translate` プロパティになる。inline style の transform と二重適用される（下部バーが半分ズレた原因）

## 3. いまのUI状態（2026-08-15夜時点）

- **フィードは「コトヅテ型」を試験中**: オレンジ枠・わらわ〜ロゴ帯なし / 白い連続列+細線区切り(border-[#f0ece0]) / 左右いっぱい(-mx-2) / 白セクション上角は四角・下角丸は廃止済み / ワラエル透かしだけ右下に残す(84px・opacity 0.12・-8°)
  - **戻すかも、と言われている**。戻す時は commit `a8c9b0b`（コトヅテ型切替）を revert（+その後の折りたたみコミット6b69d7eに注意）
- 3フィード(助けたい=OffersSection/助けて=GroupFeed/掲示板=ActivityFeed)の記事挙動は**コトヅテ完全準拠**: いいね(白抜き→赤)・コメント・⋯(編集/削除/通報・管理者もOK)・1行→もっと見る⇔△折りたたむ・写真ライトボックス・OGP埋め込み・いいねした人の顔(ハート下・最大3人+他N人)
- 編集(?edit=1)は**画像の差し替え可**（掲示板+物資/その他とも・最大4枚）。RLSは本人or is_admin
- ☰メニュー: 全ページのヘッダー内inline（オレンジ帯ヘッダーはlight白）。マイページのみfloating。ドロワーはportal
- 下部ナビ: TalKアイコンだけの丸浮きボタン（右下・未読赤丸・自動非表示、未読あれば常時）
- 🔔お知らせ: notificationsテーブル+feed_commentsトリガ(notify_feed_comment)。アバターメニュー最上段+/notifications。**既読はタップした分だけ**(全既読ボタンは別途あり)
- 掲示板トップ: ポスターギャラリー4枚(public/posters/poster1-4.webp・タップで縦スクロール拡大)
- トップ: 「現地へ届けたい物資候補」(旧・本日の出せる物資一覧、左右幅いっぱい) → 現地入りメンバー → 使い方ボタン
- 寄付ダイアログ: ※なお…注釈は14px太字。寄付ボタン押下で事務局から自動TalK(/api/donate-talk・重複防止)
- 現地入り立候補フォーム: ①②③形式の募集要項(8月下旬〜10月初旬)
- 模擬データ（サンプル隊員①〜⑤）は**削除済み**・採番リセット済み（次の参加者はNo.2）

## 4. 設計の絶対ルール

- OneSea (C:\Users\waras\onesea) は**読み取り専用の参考**。コード流用は推奨・書き込み/コミット禁止
- 表記は波ダッシュ「わらわ〜」。テーマ色 #d96a1a（相方#c05e14）
- 全書き込みはGoogle認証必須+ensureProfileでマイページ自動保証。匿名JWTはrestrictiveポリシーで全面禁止
- 事務局: mitsulow（OFFICE_USER_ID ef90d04d-99c8-4a8a-967a-5a46f15eedcc）。管理者管理は/office内
- item_key規約: `board:<id>` / `offer:<id>`（feed_likes/feed_comments/post_reports/notifications共通）
- 速さ優先（災害対応）。ただしpush前ビルド確認だけは守る

## 5. 未対応・保留

- コトヅテ型フィードの本採用 or mond枠復帰（ユーザー判断待ち）
- 提案済み未実装: 叶いました✅ / 物資の採用ボタン→自動TalK / シェアボタン+OGP画像 / 現地報告ハイライト
- OneSea側のLINEブラウザ対策（別プロジェクト・デスクトップに引き継ぎ書）

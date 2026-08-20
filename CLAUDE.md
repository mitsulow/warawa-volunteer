# わらわ〜ボランティア — 引き継ぎ書（CLAUDE.md）

熊本地震支援サイト。本番 https://warawa-volunteer.vercel.app / repo mitsulow/warawa-volunteer。
solo dev・main直push OK。**実ユーザーが既に投稿中**（No.4 さやか@埼玉さん等）なので本番を壊さないこと。
最終更新: 2026-08-16

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
- anon/service鍵・VAPID・DBパスワード: `~/.warawa-env` / **R2の鍵**(バケットwarawa-images限定トークン・公開URL): `~/.warawa-r2.txt` / Management APIトークン: `~/.rakuichi-env` の `SUPABASE_ACCESS_TOKEN`
- DB操作は Management API `/v1/projects/dmixilrcxiofanwfhxfq/database/query` に POST。**User-Agentヘッダ必須**（無いとCloudflare 403 code 1010）。**1リクエスト=1トランザクション**
- Vercel env設定済み: VAPID_PRIVATE_KEY / SUPABASE_SERVICE_ROLE_KEY / R2_BUCKET / R2_PUBLIC_URL / R2_S3_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY（2026-08-16・R2稼働中）

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

### 2026-08-16 の変更（新しい順）
- **📦物資リスト(2026-08-20)**: /office タブ下の「物資をリスト化する」ボタン → /office/goods（管理者専用）。物資(goods)全件をジャンル別に 画像サムネ(タップでLightbox)・数量(オレンジ強調・無記載は薄字)・提供者(No.付き)・届け方・送り先枠・応援完了 で一覧。「📋リストを文章でコピー」でTalK/LINE貼り付け用テキスト(応援完了除く)。db: `fetchGoodsOffers()`(goods全件・最大400)
- **掲示板の並び順アルゴリズム(2026-08-18)**: ActivityFeed `rank()` = 📌固定 → 写真/リンク付き or 寄付報告以外の投稿 → 「寄付しました」系(`DONATION_RE`: 寄付|寄附|振込|振り込|送金|入金|支援金|募金|少額|心ばかり|微力|わずか|お役に立て・写真なし)。各段の中は新しい順。クライアント側の並べ替えのみ(DBは不変)
- **掲示板の「トップに固定」(Facebook風・2026-08-18)**: board_messages.pinned_at。管理者は投稿の⋯メニュー「📌 トップに固定／解除」。ActivityFeed は `fetchPinnedBoard`(最大5件・固定が古い順)を先頭に出し「📌 トップに固定」ラベル。さやかさんの10年前アルバム(f7966ea4…)を固定中。同時に `fetchBoard` が昇順limit200＝古い200件しか取れない潜在バグを修正(降順200→反転)
- **助けたい一覧の取得を種別で分割(2026-08-17)**: `fetchOffers()`=寄付以外を最新400件+寄付(money)は最新 `MONEY_FEED_LIMIT`(60)件を並列取得してマージ。件数バッジの寄付は `fetchMoneyOfferCount()`(head count)で実数。以前は全種別まとめて200件だったので寄付326件に押し出されて「動けます」が53件中26件しか出なかった
- **調整くんUI(2026-08-17)**: 一枚の表に統合。縦=候補日時／横=参加者。「○の人数」バッジ+○率で行の緑を濃く+👑最有力。ログイン中は左端「あなた」列のマルをタップで○→△→×、下の「この内容で回答する(n/N件)」で保存。締切後は自分も他の列に含める
- **👥グループTalK(LINEグループ相当・2026-08-17)**: `groups`(name/description/kind normal|schedule/schedule_id/created_by)+`group_members`(role owner|member/last_read_at)+`group_messages`(body/image_url/system)。RLS: 読みはメンバーor管理者、グループ作成/メンバー追加は管理者(オーナーも追加可)、退出は本人、送信はメンバー(BAN/シャドウ不可)、削除は本人or管理者(`scripts/groups.sql`・`is_group_member()`)。unread_total RPCにグループ未読を加算済み。lib `src/lib/groups.ts`／画面 `/talk/group/[id]`(LINE風: 他人は左にアイコン+名前・日付区切り・システム行・メンバー一覧シート・長押しコピー/削除・12sポーリング)／一覧 /talk に「招待されたグループ」行(未読はアイコン右上赤丸)／プッシュ `/api/push-group-talk`(送信者以外のメンバー・invite指定なら招待者だけ)。**kind='schedule' のグループは調整くん(PinnedSchedule)をトップに固定**(最有力3件+○△×回答ボタン→/schedule/[id]?back=/talk/group/<id>で戻れる)。事務局(/office 現地入りタブ)の `GroupAdminSection` で作成・「現地入り立候補者を全員招待」「管理者を招待」「わらわ〜番号で招待」。**本番グループ**: 『現地入り説明会Zoom日程調整グループ』 id `e5144cbf-ab09-4f5d-86b3-a9421475bbfc`(schedule 8adf3fc0…に紐付け)
- **寄付ダイアログ最終形(2026-08-16昼・ユーザー指定レイアウト)**: ①②③の説明文 → 「予定している寄付金額」プルダウン(1/3/5/10/20/30/50/100口＋その他入力・最大1万口) → 「掲示板への記載」2択ラジオ(並べる/並べない) → 口座情報コピー(口座は小さく1行表示) → 「この内容で申し込む」。口座番号は事務局TalK(「寄付予定X口X円です。以下の口座へお振込みを…」+ゆうちょ手順)で届く
- **寄付フロー刷新**: 4ボタン(寄付をする/現地へ行く/物資を送る/その他)は折りたたみ無しで常時表示。寄付=`DonateDialog`(OffersSection内)で口数(1口1,000円・±/クイック/最大1万口)→ offers(kind=money, detail「私はX口（X,000円）の寄付をする予定です。」)を作りフィードに並べる＋`/api/donate-talk`({units})で事務局から口座案内TalK(直近10分は重複送信しない)。申込は2択: ①寄付予定を掲示板(フィード)に並べる=offer作成 / ②並べずに寄付=offer無し。どちらもTalK送信。未ログインでもダイアログは開ける(申込ボタンで参加)。ゆうちょ手順は赤字「※ゆうちょ銀行から振り込む場合はこちら▽」の折りたたみ(枠なし)
- **寄付申込の保管**: `donations`テーブル(user_id/units/amount/listed/email=Google認証メール/display_name)。`/api/donate-talk`がservice roleで毎回insert(①②とも)。RLSは管理者のみSELECT。事務局 /office に「💰 寄付申込」一覧＋「メールアドレスを全部コピー」(後日メール連絡用。送信基盤は未定=Gmailアプリパスワード案 or Resend)
- 現地入り立候補(body offer)もフィードに並ぶ: 公開はニックネーム・アイコン・SNS一覧(profiles.sns・OFFER_SELECTに追加)・私にできる事PR・動ける期間のみ。本名/電話/住所は profile_private(事務局のみ)。BodyApplyDialogの説明文にも明記
- **プッシュ通知の方針(2026-08-16夜)**: スマホへのプッシュは 1対1TalK(/api/push)・事務局のお知らせ配信(/api/push-broadcast)・寄付案内TalK のみ。掲示板/助けての新規投稿(/api/push-group)は呼ばない(ルートは残置)。🔔お知らせ(コメント/友達申請等)はアプリ内バッジのみでプッシュしない
- **物資のジャンル**: offers.category(rice/veg/ferment/sweets/sake/daily/other・`src/lib/goodsCategories.ts`)。投稿時に必須選択。カード(GoodsSupportBlock)と「現地へ届けたい物資候補」右下に表示。既存7件は内容から手動振り分け済み
- **事務局ページはタブ制(OneSea方式)**: 🏃現地入り／⚑通報／🐛バグ／💰寄付／📢配信(お知らせ配信+全面ポップアップ)／🛠管理(書き込み禁止+管理者の管理)。現地入り・通報・バグは「未対応／対応済み」セグメント。通報は削除ではなく post_reports.status(open/done)で保持・未対応に戻せる
- **毎晩バックアップ**: `scripts/backup.py`(全publicテーブル+auth.users(メール)+storage一覧をJSONで デスクトップ/わらわ〜バックアップ/YYYY-MM-DD/・30日保持)。Windowsタスクスケジューラ `WarawaVolunteerBackup` 毎日03:30(`scripts/backup.cmd`・ログ scripts/backup_run.log)。手動は「バックアップ取って」→ `python scripts/backup.py`
- **📅日程調整(調整さん風・2026-08-17)**: `schedules`(title/description/slots jsonb/closed)+`schedule_answers`(answers jsonb {slotIndex:'o'|'d'|'x'}, comment)。/schedule/[id]=○△×グリッド+集計+最有力・自分の回答。事務局(現地入りタブ)で作成、`/api/schedule-invite`で現地入り立候補者(未回答)へ事務局ボットからTalK+プッシュ。lib は `src/lib/schedule.ts`
- **見えないモード(シャドウBAN・2026-08-17)**: profiles.shadow_at/shadow_reason・`is_shadowed()`・`visible_author(author)`(=シャドウでない or 本人 or 管理者)。board_messages/offers/feed_comments/feed_likes のSELECTと goods_requests/voice_supports のSELECT・集計RPCに適用。can_talk はシャドウならfalse、messages/friendships insertも禁止。通知トリガはシャドウの行動を無視。管理者はマイページ「👻 見えないモードにする」・/office管理タブで解除（`scripts/shadowban.sql`,`shadowban2.sql`）
- **書き込み禁止(BAN)**: profiles.banned_at/banned_reason・`is_banned()`・書き込み系12テーブルに restrictive「no banned insert/update」(`scripts/ban.sql`)。管理者はマイページの「🚫 書き込み禁止にする」・/office「書き込み禁止中のユーザー」で解除。本人のトップに停止バナー
- 使い方 /guide は5ステップ+べんりメモ(寄付口数/届け方/応援のながれ/友達申請/バグ報告)に更新済み
- 🐛バグ報告(OneSea移植): 右上アバターメニュー(使い方の下・小さめ表記)→ /bug-report → `bug_reports`(RLS: 本人insert・管理者read/update)→ /office「🐛 バグ報告」で対応済みに
- **助けての「私が応援します」(2026-08-16夜・v2)**: `voice_supports`(`scripts/voice_supports.sql`+`voice_supports_v2.sql`)。**押した瞬間に成立(status=accepted・1人だけ・RLSで2人目は弾く)**→トリガで友達承認+🔔→写真は白黒＋「現在やり取り中」スタンプ(重複送付防止)。決裂したら投稿主が「違う人に応援を求める」(declined→募集中に戻る・応援者に🔔)。TalKで取引が完了したら投稿主/管理者が「応援完了」(board_messages.status='done')。UI `VoiceSupportBlock`。右上アバターメニューに管理者だけ「事務局ページ」
- **Lightbox**(`Lightbox.tsx`・全フィード/ポスター/投稿ページ共通): 左右スワイプ(スナップ・指に追従)・ピンチ/ダブルタップ拡大・n/N表示
- **物資の届け方(2026-08-16夜・事務局要望)**: offers.route(orange=オレンジ軍団に託す/direct=個人的に支援/both)・quantity(数量テキスト)・slots(送り先何か所まで=送料は送り手負担)・done(応援完了=SOLD OUT相当)。`goods_requests`(受け取り希望・pending/accepted/declined・`scripts/goods_direct.sql`)。投稿主が「この人に決めた」→トリガで友達承認+🔔+枠が埋まれば自動で応援完了。UIは `GoodsSupportBlock`(カード/投稿ページ)、写真に `Stamp`「応援完了」。事務局の自動コメントは orange/both のみ(directには付けない)
- **R2導入(2026-08-16夜・OneSea方式移植)**: `src/lib/r2.ts` + `/api/upload`(ログイン必須・3MB・画像のみ)。クライアント `images.ts` は WebP圧縮(本体1280 q0.72/サムネ560 q0.7)→R2優先→失敗/未設定なら Supabase Storage にフォールバック。Vercel env: R2_S3_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET(warawa-images) / R2_PUBLIC_URL(pub-….r2.dev)。**OneSeaのバケット(onesea-images)は使わない**（トークンもそのバケット限定なので別トークン必須）。R2のURLは cdnify を素通り(転送料ゼロなのでプロキシ不要)
- **Supabase無料枠対策(2026-08-16夜)**: 画像は `/img/<path>`(Route Handler src/app/img/[...path]/route.ts→Storage photos・s-maxage=1年でVercel CDNにキャッシュ。外部rewriteはCDNキャッシュされないので関数方式)。db.tsの主要フェッチで `cdnify()`(絶対URL→/img/)、保存時は `storageUrl()` で絶対URLに戻す(DBには常に絶対URL)。本体画像1280px q0.8/サムネ480px。ポーリング: フィード15s・グループTalK8s・DM5s・一覧15s・バッジ20-25s。無料枠=転送5GB/月・DB500MB・Storage1GB。危なくなったらSupabase Pro($25)へ
- 掲示板の最初の投稿: 10年前の写真アルバム21枚(さやかさん名義・`scripts/_post_album.py`で登録・board_messages f7966ea4…)。カルーセルは枚数無制限表示(投稿UIは4枚まで)
- 本文のURLは `Linkify` で自動リンク(全フィード/投稿ページ/コメント/TalK)。助けての投稿者アイコンもマイページへリンク
- アイコン変更は `AvatarCropper`(丸トリミング・ドラッグ/スライダー/ピンチ・512px jpeg)経由。登録フォーム(RegisterDialog)とマイページ両方。アップ中は画像欄に「更新中…」
- **事務局ボットアカウント(2026-08-16)**: auth user `office@warawa-volunteer.vercel.app` / id `2b9f33c9-9ad1-4b39-bb1f-8dc7a225fbbf` / 表示名「わらわ〜ボランティア事務局」/ アイコン `public/office-avatar.png`(丸+ワラエル+事務局・`scripts/make_office_avatar.py`) / member_no=null。ログインはしない(service roleとDBトリガ専用)。**DBトリガ `trg_office_auto_comment_goods`(offers AFTER INSERT・`scripts/office_auto_comment_trigger.sql`)** が物資(goods)・現地へ行く(body)・寄付(money)の投稿に自動でお礼コメント(feed_comments)を付ける→notify_feed_commentで投稿者に🔔も飛ぶ。**寄付案内TalKの差出人も事務局ボット(OFFICE_BOT_ID in config.ts)** に変更(2026-08-16夕)。管理者は /talk の「事務局の受信箱」でボット宛TalKを読み、事務局として返信できる(`scripts/office_inbox_rls.sql`: chats/messages RLSに管理者+ボットチャット条項、unread_total RPCも受信箱を加算、/api/push はボット宛→全管理者へ通知・管理者送信→差出人ボット)。TalK一覧: ヘッダー=戻る+中央TalK、未読はアイコン右上の赤丸
- **友達申請(2026-08-16夜)**: `friendships`(requester/addressee/status pending|accepted・`scripts/friendships.sql`)。1対1TalKの新規作成(chats insert)は `can_talk(自分,相手)`=事務局ボットが絡む or **始める側が管理者**(一般人→管理者は申請が必要・片方向) or 友達承認済み のみ。マイページのボタンが状態で変わる(友達申請をする→申請中・取り消す／承認する・断る→TalKで連絡を取る)。申請/承認は🔔通知(kind friend_request/friend_accept・トリガ notify_friendship)。既存チャットは影響なし
- **了承事項ゲート(2026-08-16)**: 本文は `src/lib/terms.ts`(TERMS_VERSION を上げると全員に再表示)。profiles.terms_accepted_at/terms_version。初回登録(RegisterDialog isFirst)はチェック必須、既存ログインユーザーは layout常駐の `TermsGate` が全面表示(未ログイン=閲覧のみには出ない)。全文ページ /terms(☰メニューにも)
- **掲示板は分離(2026-08-16昼)**: ActivityFeed は board_messages(scope=board)だけ=「つながりのための掲示板」。助けたい(offers)は助けたいタブ、助けて(voice)は助けてタブにだけ並ぶ
- donate-talk: プロフィール未作成ユーザーでもTalKが作れるようAPI側でprofilesを自動作成(chats FK対策・E2Eで発覚)。DonateDialog②でもensureProfile
- フィード(助けたい)は offers **4種すべて**表示。チップ=PostKit `CHIP_STYLE`(寄付します=金/物資を送れます=橙/動けます=青/アイディア=緑 ※4ボタンの表示名は寄付をする/現地へ行く/物資を送る/その他のまま)。その他の投稿欄見出し「私が持ち寄れる「アイディア」や意見、その他の情報はこちらへ」・フィード上部に薄い1段のジャンル切替 `KindFilterTabs`(物資/動けます/寄付/アイディア/すべて・件数バッジ)。助けたいの初期表示は**物資だけ**、掲示板は「すべて」。カードのチップタップでも切替
- 表記「@わらわ〜ボランティアNo.X」（旧「@ボランティアNo.X」）
- **画面が開くのが遅い対策**: /talk/g/[scope] は generateStaticParams(board/voice)でSSG、/talk/[chatId] と /u/[id] は layout.tsx で `dynamic="force-static"`（クライアント描画のみなのでシェルを静的化・サーバー関数のコールドスタート回避）。/post/[type]/[id] はサーバー描画のまま
- 物資を出す③の文言: 「返信メールに記載された住所へ、送料をお客さま負担にて発送して下さい。」
- TalK吹き出し=LINE風（既読・時刻は吹き出しの外）。長押し(500ms)/右クリックで `BubbleMenu`(コピー/削除)。DMの削除は本人のみ(messagesにDELETE RLS「messages delete own」追加)。グループTalKは本人or管理者(掲示板からも消える)
- 通知アイコン: ステータスバー小アイコン(badge)=`public/badge-96.png`(白+透明ワラエル・`scripts/make_badge.py`)、大アイコン(icon)=`public/notify-icon-256.png`(オレンジリング+クリーム丸+ワラエル・`scripts/make_notify_icon.py`)。sw.jsで指定・CACHEはv3
- TalK/配信/コメントの入力欄は改行可（`MessageInput`: 自動伸縮textarea・スマホEnter=改行・PCはEnter=送信/Shift+Enter=改行）
- 一度実装→同日revert: 叶いました✅・物資の採用→自動TalK・シェア+OGP（commit e9b2ec1。復活は `git revert e9b2ec1`。DBの board_messages.status/done_at 列は残置・無害）
- E2E: `python scripts/_e2e_donate.py`（使い捨てユーザーで本番 /api/donate-talk を叩き、TalK/donations を確認して掃除。Management APIでservice roleを取得）
- DB操作の小道具: `python scripts/dbq.py "SQL"`（Management API・User-Agent付き）

## 4. 設計の絶対ルール

- OneSea (C:\Users\waras\onesea) は**読み取り専用の参考**。コード流用は推奨・書き込み/コミット禁止
- 表記は波ダッシュ「わらわ〜」。テーマ色 #d96a1a（相方#c05e14）
- 全書き込みはGoogle認証必須+ensureProfileでマイページ自動保証。匿名JWTはrestrictiveポリシーで全面禁止
- 事務局: mitsulow（OFFICE_USER_ID ef90d04d-99c8-4a8a-967a-5a46f15eedcc）。管理者管理は/office内
- item_key規約: `board:<id>` / `offer:<id>`（feed_likes/feed_comments/post_reports/notifications共通）
- 速さ優先（災害対応）。ただしpush前ビルド確認だけは守る

## 5. 未対応・保留

- コトヅテ型フィードの本採用 or mond枠復帰（ユーザー判断待ち）
- 提案済み未実装: 現地報告ハイライト / 叶いました✅・採用→自動TalK・シェア+OGP（実装済みをrevert中。`git revert e9b2ec1`で復活）
- OneSea側のLINEブラウザ対策（別プロジェクト・デスクトップに引き継ぎ書）

"use client";

import Link from "next/link";
import { useSession } from "@/lib/useSession";
import { BottomNav } from "@/components/BottomNav";

/* eslint-disable @next/next/no-img-element */

/** 使い方1枚ページ（ご高齢の方向け・大きい文字の3ステップ図解） */
export default function GuidePage() {
  const session = useSession();

  const step = (
    no: string,
    icon: string,
    title: string,
    lines: React.ReactNode
  ) => (
    <div
      className="overflow-hidden rounded-2xl shadow-sm"
      style={{ background: "linear-gradient(160deg,#f2a35c,#e0803a)", padding: "5px 5px 0" }}
    >
      <div className="rounded-xl bg-white p-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[22px] font-extrabold text-white"
            style={{ background: "#d96a1a" }}
          >
            {no}
          </span>
          <span className="text-3xl">{icon}</span>
          <h2 className="text-[20px] font-extrabold text-[#3a3428]">{title}</h2>
        </div>
        <div className="mt-3 space-y-2 text-[17px] leading-relaxed text-[#3a3428]">{lines}</div>
      </div>
      <div className="flex h-[22px] items-center justify-end pr-2.5">
        <img src="/warawa-logo.png" alt="わらわ〜" className="h-[14px] w-auto object-contain" />
      </div>
    </div>
  );

  return (
    <main className="min-h-screen pb-24" style={{ background: "#faf6ee" }}>
      <header className="sticky top-0 z-30 border-b border-[#ede5d8] bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link href="/" className="shrink-0 rounded-full border px-3 py-1 text-[12.5px] font-bold no-underline" style={{ color: "#d96a1a", borderColor: "#f0d0a8", background: "#fff" }} aria-label="戻る">
            戻る
          </Link>
          <img src="/waraeru-v2.png" alt="" className="h-8 w-8 object-contain" />
          <h1 className="text-[17px] font-bold" style={{ color: "#d96a1a" }}>
            使い方（かんたんガイド）
          </h1>
        </div>
      </header>

      <div className="space-y-4 px-4 pt-4">
        {step(
          "1",
          "🔑",
          "ログインする",
          <>
            <p>
              画面右上の <b style={{ color: "#d96a1a" }}>●参加</b> ボタンを押して、
              <b>「Googleでログイン」</b>を押します。
            </p>
            <p>
              いつものGoogle（Gmail）のアカウントを選ぶだけ。
              <b>パスワードを新しく作る必要はありません。</b>
            </p>
            <p>お名前を確認して「登録して参加する」を押せば完了です。</p>
          </>
        )}

        {step(
          "2",
          "📱",
          "ホーム画面に追加する",
          <>
            <p>
              開いたときに出る<b>「ホーム画面に追加できます」</b>の案内で
              <b style={{ color: "#d96a1a" }}>「ホーム画面に追加」</b>を押します。
            </p>
            <p>
              スマホのホーム画面に<b>ワラエルのアイコン</b>が増えて、
              次からはアプリのようにワンタッチで開けます。
            </p>
            <p className="text-[15px] text-[#8a8070]">
              案内が出ない場合：iPhoneは共有ボタン⬆︎→「ホーム画面に追加」、
              Androidは右上の⋮→「ホーム画面に追加」
            </p>
          </>
        )}

        {step(
          "3",
          "✏️",
          "投稿する",
          <>
            <p>
              困っている方は<b style={{ color: "#d96a1a" }}>「助けて」</b>タブで
              <b>「こちらにお書きください」</b>を押し、
              県と市町村を選んで、欲しい物・やって欲しい事を書いて<b>「投稿」</b>。
            </p>
            <p>
              助けたい方は<b style={{ color: "#d96a1a" }}>「助けたい」</b>タブの4つのボタン
              <b>「寄付をする」「現地へ行く」「物資を送る」「その他（アイディア）」</b>から選びます。
            </p>
            <p className="text-[15px] text-[#8a8070]">
              寄付は「何口（1口1,000円）」を選ぶだけ。口座番号は事務局からTalKで届きます。
              物資は「数量」と「届け方（避難所へまとめて／個人間で直接／両方可）」を選びます。送料は送る方のご負担です。
            </p>
          </>
        )}

        {step(
          "4",
          "🙌",
          "応援のながれ",
          <>
            <p>
              <b style={{ color: "#d96a1a" }}>助けて</b>の投稿に
              <b>「🙌 私が応援します」</b>を押すと、その場であなたに決まり、
              投稿は<b>「現在やり取り中」</b>になります（同じ物が2人から届くのを防ぐため）。
            </p>
            <p>
              自動でお互い友達になるので、そのまま<b>TalK</b>で送り先などを相談。
              話がまとまったら投稿主が<b>「応援完了」</b>を押します。
              うまくいかなければ投稿主が「違う人に応援を求める」で募集し直せます。
            </p>
            <p>
              <b style={{ color: "#d96a1a" }}>物資</b>の「個人間で直接」の投稿には
              <b>「🙋 受け取りを希望する」</b>が出ます。投稿主が「この人に決めた」を押すと、TalKで受け渡しの相談ができます。
            </p>
          </>
        )}

        {step(
          "5",
          "🤝",
          "TalK（メッセージ）と友達申請",
          <>
            <p>
              1対1のTalKは、<b>友達申請→承認</b>された人どうしで使えます。
              相手のお顔（アイコン）→マイページの<b>「友達申請をする」</b>から。
            </p>
            <p>
              上の「応援します」「この人に決めた」の流れでは<b>自動で友達になる</b>ので申請は不要です。
              事務局からのTalK（寄付の口座案内など）はいつでも届きます。
            </p>
            <p className="text-[15px] text-[#8a8070]">
              TalKの吹き出しは長押しでコピー・削除（自分の分）。写真は左右スワイプ・ダブルタップで拡大できます。
            </p>
          </>
        )}

        {step(
          "＋",
          "💡",
          "べんりメモ",
          <>
            <p>
              画面左上の <b style={{ color: "#d96a1a" }}>☰（三本線）</b>を押すと、
              どのページからでも<b>メニュー</b>が開きます。
              助けたい・助けて・掲示板・TalK・マイページなどへすぐ移動できます。
            </p>
            <p>
              画面右下に出てくる<b>緑の吹き出しボタン</b>は
              <b style={{ color: "#d96a1a" }}>TalK（メッセージ）</b>です。
              <b>新しいメッセージが届くと数字つきで出てきます。</b>
            </p>
            <p>
              右上のお顔（アイコン）を押すと、🔔お知らせ・マイページ・
              <b>🐛 バグを事務局へ報告</b>などが並びます。おかしいと思ったら気軽に送ってください。
            </p>
          </>
        )}

        <p className="px-2 py-4 text-center text-[15px] leading-relaxed text-[#8a8070]">
          わからないことがあれば、掲示板に気軽に書いてください。
          <br />
          届けたいのは「大丈夫」、配りたいのは「笑顔」。
        </p>
      </div>

      <BottomNav userId={session.userId} active="home" />
    </main>
  );
}

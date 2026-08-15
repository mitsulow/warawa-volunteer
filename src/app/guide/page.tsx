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
      <header className="sticky top-0 z-30 border-b border-[#ede5d8] bg-white/95 py-3 pl-14 pr-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xl no-underline" style={{ color: "#d96a1a" }} aria-label="戻る">
            ←
          </Link>
          <img src="/waraeru-v2.png" alt="" className="h-8 w-8 object-contain" />
          <h1 className="text-[17px] font-bold" style={{ color: "#d96a1a" }}>
            使い方（かんたん3ステップ）
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
              助けたい方は<b style={{ color: "#d96a1a" }}>「助けたい」</b>タブの
              <b>「何ができるかを選ぶ」</b>から、寄付・現地へ行く・物資などを選びます。
            </p>
            <p>
              投稿への返事は、投稿の下の<b>吹き出しマーク（コメント）</b>や、
              相手のお顔（アイコン）を押して<b>「連絡を取る」</b>からできます。
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

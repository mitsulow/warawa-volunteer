"use client";

import { useState } from "react";
import type { BodyApplication } from "@/lib/db";

/**
 * 事務局: 現地入りメンバーへの一斉メール用ツール。
 * ①メールアドレスをBCC用にコピー ②案内文（ホーム画面に追加+通知ONの手順入り）をコピー。
 * メール送信自体は事務局（西田あかねさん）が普段のメールソフトで行う。
 */
export function BodyMailSection({ apps }: { apps: BodyApplication[] }) {
  const [copied, setCopied] = useState<"" | "mail" | "body">("");

  // 申請フォームに書かれた連絡用メール（重複申請・同一メールは1つに）
  const emails = Array.from(
    new Set(
      apps
        .map((a) => a.profiles?.profile_private?.email?.trim().toLowerCase() ?? "")
        .filter((e) => e.includes("@"))
    )
  );

  const MAIL_TEMPLATE = `件名: 【わらわ〜ボランティア】現地入り説明会（Zoom）のご案内

現地入りメンバーへご応募いただき、ありがとうございます。
わらわ〜ボランティア事務局の西田あかねです。

現地入りについての説明会をZoomにて行ないます。
応募人数が多数のため選抜となります。参加人数が多い時間帯で開催させて頂きます。
また、人物像や人柄などを把握するために、必ずカメラはONにてご参加ください。

▼ 日時
●月●日（●）●●:●●〜

▼ Zoom URL
（ここにZoomのURLを貼ってください）

──────────────────
▼ 事前のお願い【必ずお願いします】
──────────────────
今後の緊急連絡（集合時間の変更・現地からのSOSなど）は、
わらわ〜ボランティアのサイトのTalKとスマホへのプッシュ通知でお送りします。
必ず「ホーム画面に追加」をして、「通知をオン」にしておいてください。

【iPhoneの方】
① Safariで https://warawa-volunteer.vercel.app を開く
　※LINEやこのメールから開いた場合は、画面右下の「共有」→「Safariで開く」で開き直してください
② 画面下の共有ボタン（□に↑のマーク）をタップ
③ 下にスクロールして「ホーム画面に追加」をタップ →「追加」
④ ホーム画面にできた「わらわ〜」のアイコンから開き直す
⑤ 画面下に出る「🔔 TalKの新着をプッシュ通知で受け取れます」の「オンにする」を押す
⑥ 「"わらわ〜ボランティア"は通知を送信します。よろしいですか？」→「許可」

【Androidの方】
① Chromeで https://warawa-volunteer.vercel.app を開く
② 右上の「︙」→「ホーム画面に追加」（または「アプリをインストール」）→「追加」
③ 画面下に出る「🔔 TalKの新着をプッシュ通知で受け取れます」の「オンにする」を押す
④ 「通知の送信を許可しますか？」→「許可」

✅ 設定できているかの確認
ホーム画面の「わらわ〜」アイコンから開いて、サイトの右下のTalKボタンが見えていればOKです。
うまくいかない場合は、サイトのTalKで「わらわ〜ボランティア事務局」までご連絡ください。

──────────────────
わらわ〜ボランティア事務局　西田あかね
https://warawa-volunteer.vercel.app
──────────────────`;

  const copy = async (text: string, which: "mail" | "body") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(""), 2500);
    } catch {
      window.alert("コピーできませんでした");
    }
  };

  return (
    <section className="rounded-2xl border border-[#f0d0a8] bg-[#fffaf0] p-3">
      <h2 className="text-sm font-extrabold text-[#c05e14]">📧 現地入りメンバーへ一斉メール</h2>
      <p className="mt-1 text-[11.5px] leading-relaxed text-[#8a7a5a]">
        ①でメールアドレスをコピーして、メールソフトの<b className="text-[#c05e14]">BCC欄</b>に貼り付け（宛先には自分のアドレスを入れる）。
        ②で案内文（Zoom説明会+「ホーム画面に追加・通知オン」の手順入り）をコピーして本文に貼り、日時とZoom URLを書き換えて送信。
      </p>
      <div className="mt-2 space-y-1.5">
        <button
          onClick={() => copy(emails.join(", "), "mail")}
          className="w-full rounded-xl py-2.5 text-[13px] font-extrabold text-white"
          style={{ background: copied === "mail" ? "#2e7d4f" : "#d96a1a" }}
        >
          {copied === "mail" ? "✅ コピーしました" : `① メールアドレスをコピー（BCC用・${emails.length}人）`}
        </button>
        <button
          onClick={() => copy(MAIL_TEMPLATE, "body")}
          className="w-full rounded-xl border py-2.5 text-[13px] font-extrabold"
          style={copied === "body" ? { background: "#2e7d4f", borderColor: "#2e7d4f", color: "#fff" } : { background: "#fff", borderColor: "#d96a1a", color: "#c05e14" }}
        >
          {copied === "body" ? "✅ コピーしました" : "② 案内文の下書きをコピー（通知オンの手順入り）"}
        </button>
      </div>
      <p className="mt-1.5 text-[10.5px] text-[#a09888]">
        ※メールアドレスは申請フォームに記入された連絡先です。BCCに入れないと全員にアドレスが見えてしまうので注意。
      </p>
    </section>
  );
}

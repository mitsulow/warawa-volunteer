"use client";

/** バグを事務局へ報告（右上アバターメニューから・OneSea移植）。上がったバグは事務局ページの「🐛 バグ報告」に並ぶ */

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { ensureProfile } from "@/lib/db";

export default function BugReportPage() {
  const session = useSession();
  const [body, setBody] = useState("");
  const [from, setFrom] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  useEffect(() => {
    try {
      setFrom(document.referrer && document.referrer.includes(location.host) ? new URL(document.referrer).pathname : "");
    } catch {}
  }, []);

  const send = async () => {
    if (!session.userId || !body.trim() || state !== "idle") return;
    setState("busy");
    await ensureProfile(session.userId);
    const { error } = await createClient().from("bug_reports").insert({
      user_id: session.userId,
      body: body.trim(),
      page_url: from || null,
      ua: navigator.userAgent.slice(0, 250),
    });
    setState(error ? "idle" : "done");
    if (error) alert("送信できませんでした。もう一度お試しください");
  };

  return (
    <main className="min-h-dvh pb-16" style={{ background: "#faf6ee" }}>
      <header className="pt-safe-head sticky top-0 z-30 border-b border-[#ede5d8] bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="relative flex items-center justify-center">
          <Link href="/" className="absolute left-0 rounded-full border px-3 py-1 text-[12.5px] font-bold no-underline" style={{ color: "#d96a1a", borderColor: "#f0d0a8", background: "#fff" }}>
            戻る
          </Link>
          <span className="text-[14px] font-bold text-[#1c1e21]">🐛 バグを事務局へ報告</span>
        </div>
      </header>
      <div className="mx-auto max-w-[480px] px-5 pt-5">
        <p className="text-[12.5px] leading-relaxed text-[#8a8070]">
          「押しても反応しない」「表示が崩れる」「消えた」など、おかしいと思ったことを教えてください。
          言葉での説明でOK。どのページで起きたか、スマホの機種も書いてもらえると助かります。
        </p>

        {!session.loading && !session.userId && (
          <p className="mt-4 rounded-xl bg-white p-4 text-[13px] text-[#8a8070]">報告にはログインが必要です</p>
        )}

        {state === "done" ? (
          <div className="mt-4 rounded-2xl bg-white p-5 text-center" style={{ border: "1px solid #e5dcc8" }}>
            <div className="text-[28px]">🙏</div>
            <p className="mt-1 text-[14px] font-extrabold" style={{ color: "#2e7d4f" }}>報告ありがとうございます！</p>
            <p className="mt-1 text-[12px] text-[#8a8070]">事務局が確認して、直していきます。</p>
            <Link href="/" className="mt-4 inline-block rounded-full border border-[#e0d6c6] bg-white px-5 py-2 text-[12.5px] font-bold text-[#8a7a5a] no-underline">
              トップへもどる
            </Link>
          </div>
        ) : (
          session.userId && (
            <>
              <input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="どのページ？（例: 助けたい、マイページ、TalK など）"
                className="mt-4 w-full rounded-xl border border-[#e0d6c6] bg-white px-4 py-2.5 text-[13px] outline-none focus:border-[#d96a1a]"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={7}
                maxLength={2000}
                placeholder={"何が起きた？\n（例: 写真を選んでも「更新中…」のまま止まる。iPhoneのSafariです）"}
                className="mt-2 w-full rounded-xl border border-[#e0d6c6] bg-white p-4 text-[14px] leading-relaxed outline-none focus:border-[#d96a1a]"
              />
              <button
                onClick={send}
                disabled={!body.trim() || state === "busy"}
                className="mt-3 w-full rounded-2xl py-3.5 text-[14.5px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#d96a1a" }}
              >
                {state === "busy" ? "送信中..." : "事務局へ送る"}
              </button>
            </>
          )
        )}
      </div>
    </main>
  );
}

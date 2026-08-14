"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

/**
 * 事務局への通報フォーム（OneSeaから移植）。
 * 送信先は post_reports → 事務局ページ(/office)の通報受信箱。
 */
export function ReportDialog({
  itemKey,
  excerpt,
  meId,
  onClose,
}: {
  itemKey: string;
  excerpt: string;
  meId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("post_reports").insert({
      item_key: itemKey,
      excerpt: excerpt.slice(0, 120),
      reporter: meId,
      reason: reason.trim(),
    });
    setBusy(false);
    if (error) {
      setReason((r) => r); // 保持
      alert("送信できませんでした: " + error.message);
      return;
    }
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center px-5" onClick={onClose}>
      <div className="absolute inset-0 bg-black/55" />
      <div
        className="relative w-full max-w-[360px] rounded-3xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[15px] font-extrabold text-[#3a3428]">⚑ 事務局に通報する</div>
        {done ? (
          <>
            <p className="mt-3 text-[13px] leading-relaxed text-[#5a5448]">
              事務局に通報しました。内容を確認して対応します。ご協力ありがとうございます🙏
            </p>
            <button
              onClick={onClose}
              className="mt-4 w-full rounded-2xl py-3 text-[14px] font-extrabold text-white"
              style={{ background: "#a84e0e" }}
            >
              とじる
            </button>
          </>
        ) : (
          <>
            <p className="mt-1 text-[11px] leading-relaxed text-[#a09888]">
              迷惑行為・危険な内容など、気になる投稿を事務局に知らせます。
            </p>
            <label className="mt-3 block text-[11px] font-bold text-[#8a7a5a]">
              理由 <span className="text-[#c05030]">必須</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="どこが気になったか教えてください"
              className="mt-1 w-full rounded-xl border border-[#e8dcc4] bg-[#fffdf8] px-3 py-2 text-[13.5px] outline-none focus:border-[#d96a1a]"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-2xl border border-[#e0d6c6] py-3 text-[13px] font-bold text-[#8a8070]"
              >
                やめる
              </button>
              <button
                onClick={submit}
                disabled={busy || !reason.trim()}
                className="flex-1 rounded-2xl py-3 text-[14px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#d96a1a" }}
              >
                {busy ? "送信中..." : "通報する"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { addNeed, fetchNeeds, setNeedStatus, type Need } from "@/lib/db";

const STATUS_LABEL: Record<Need["status"], string> = {
  open: "募集中",
  doing: "対応中",
  done: "完了",
};
const STATUS_STYLE: Record<Need["status"], string> = {
  open: "bg-[#d96c2c] text-white",
  doing: "bg-[#e5b566] text-white",
  done: "bg-gray-300 text-gray-600",
};

/** 現地からの要望（やってほしいこと）。投稿・状態変更は管理者のみ */
export function NeedsSection({
  userId,
  isAdmin,
}: {
  userId: string | null;
  isAdmin: boolean;
}) {
  const [needs, setNeeds] = useState<Need[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = () => fetchNeeds().then(setNeeds);
  useEffect(() => {
    reload();
  }, []);

  const submit = async () => {
    if (!userId || !title.trim()) return;
    setBusy(true);
    await addNeed(userId, title.trim(), body.trim());
    setTitle("");
    setBody("");
    setShowForm(false);
    setBusy(false);
    reload();
  };

  const cycle = async (n: Need) => {
    if (!isAdmin) return;
    const next: Need["status"] =
      n.status === "open" ? "doing" : n.status === "doing" ? "done" : "open";
    await setNeedStatus(n.id, next);
    reload();
  };

  return (
    <section className="px-4 py-6" id="needs">
      <h2 className="text-xl font-bold mb-1">📋 現地の要望</h2>
      <p className="text-sm text-gray-600 mb-4">
        現地リーダーが「やってほしいこと」を掲載します
      </p>

      {needs.length === 0 && (
        <div className="rounded-xl bg-white p-4 text-sm text-gray-500 shadow-sm">
          現地からの要望を確認中です。掲載までしばらくお待ちください。
        </div>
      )}

      <div className="space-y-3">
        {needs.map((n) => (
          <div key={n.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold">{n.title}</h3>
              <button
                className={`text-xs px-2 py-1 rounded-full shrink-0 ${STATUS_STYLE[n.status]} ${isAdmin ? "" : "pointer-events-none"}`}
                onClick={() => cycle(n)}
              >
                {STATUS_LABEL[n.status]}
              </button>
            </div>
            {n.body && (
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                {n.body}
              </p>
            )}
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="mt-4">
          {showForm ? (
            <div className="rounded-xl bg-white p-4 shadow-sm space-y-2">
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="要望のタイトル"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="詳細（任意）"
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-lg bg-[#3a7d44] py-2 text-white font-bold disabled:opacity-50"
                  disabled={busy}
                  onClick={submit}
                >
                  掲載する
                </button>
                <button
                  className="px-4 rounded-lg border border-gray-300"
                  onClick={() => setShowForm(false)}
                >
                  やめる
                </button>
              </div>
            </div>
          ) : (
            <button
              className="w-full rounded-xl border-2 border-dashed border-[#3a7d44] py-3 text-[#3a7d44] font-bold"
              onClick={() => setShowForm(true)}
            >
              ＋ 要望を掲載する（管理者）
            </button>
          )}
        </div>
      )}
    </section>
  );
}

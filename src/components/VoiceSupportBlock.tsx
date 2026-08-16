"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  cancelVoiceSupport,
  fetchVoiceSupportsFor,
  getOrCreateChat,
  respondVoiceSupport,
  sendVoiceSupport,
  setBoardStatus,
  type BoardMessage,
  type VoiceSupport,
} from "@/lib/db";
import { Avatar } from "@/components/Avatar";

/**
 * 助けて(voice)カードの「私が応援します」ブロック。
 * - 見る人: 🙌 私が応援します（ひとこと任意）→ 投稿主に🔔
 * - 投稿主: 応援者一覧 → 「この人にお願いする」→ 自動で友達承認 → TalKで送り先など相談
 * - 投稿主/管理者: 届いたら「応援完了」（写真が白黒になり「応援完了」のたすき）
 */
export function VoiceSupportBlock({
  message,
  userId,
  isAdmin,
  counts,
  mySupport,
  requireJoin,
  onChanged,
}: {
  message: BoardMessage;
  userId: string | null;
  isAdmin: boolean;
  counts?: { pending: number; accepted: number };
  mySupport?: VoiceSupport | null;
  requireJoin: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const isOwner = !!userId && userId === message.user_id;
  const done = message.status === "done";
  const pending = counts?.pending ?? 0;
  const accepted = counts?.accepted ?? 0;
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<VoiceSupport[] | null>(null);
  const [asking, setAsking] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && (isOwner || isAdmin)) fetchVoiceSupportsFor(message.id).then(setList);
  }, [open, isOwner, isAdmin, message.id]);

  const offerHelp = async () => {
    if (!userId) {
      requireJoin();
      return;
    }
    if (busy) return;
    setBusy(true);
    const { error } = await sendVoiceSupport(message.id, userId, msg);
    setBusy(false);
    if (error) {
      window.alert("送れませんでした（すでに手を挙げているか、受付が終了しています）");
      return;
    }
    setAsking(false);
    setMsg("");
    onChanged();
  };

  const decide = async (r: VoiceSupport, status: "accepted" | "declined") => {
    if (busy) return;
    const q =
      status === "accepted"
        ? `${r.profiles?.display_name ?? "この方"}さんに応援をお願いしますか？\nお願いすると友達として登録され、TalKで送り先などを相談できます。`
        : "この応援を見送りますか？";
    if (!window.confirm(q)) return;
    setBusy(true);
    await respondVoiceSupport(r.id, status);
    setBusy(false);
    setList(null);
    fetchVoiceSupportsFor(message.id).then(setList);
    onChanged();
  };

  return (
    <div className="mt-2 rounded-xl border px-3 py-2" style={{ borderColor: "#f0e6d2", background: "#fffdf8" }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <span className={done ? "font-bold text-[#a09888]" : "font-bold"} style={done ? undefined : { color: "#2e7d4f" }}>
          {done ? "✅ 応援完了" : accepted > 0 ? `応援者が決まりました（${accepted}人）` : pending > 0 ? `🙌 応援したい人 ${pending}人` : "🙌 応援を待っています"}
        </span>
      </div>

      {/* 見る人: 私が応援します */}
      {!isOwner && !done && (
        <div className="mt-2">
          {mySupport ? (
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
              {mySupport.status === "accepted" ? (
                <>
                  <span className="font-bold" style={{ color: "#2e7d4f" }}>✅ あなたにお願いされました</span>
                  {userId && (
                    <button
                      onClick={async () => {
                        const chatId = await getOrCreateChat(userId, message.user_id);
                        if (chatId) router.push(`/talk/${chatId}`);
                      }}
                      className="rounded-full px-3 py-1 text-[11.5px] font-bold text-white"
                      style={{ background: "#d96a1a" }}
                    >
                      TalKで相談する
                    </button>
                  )}
                </>
              ) : mySupport.status === "declined" ? (
                <span className="text-[#a09888]">今回は見送りになりました</span>
              ) : (
                <>
                  <span className="text-[#8a7a5a]">手を挙げました（返事待ち）</span>
                  <button
                    onClick={async () => {
                      if (!window.confirm("応援の申し出を取り消しますか？")) return;
                      await cancelVoiceSupport(mySupport.id);
                      onChanged();
                    }}
                    className="text-[11.5px] text-[#a09888] underline"
                  >
                    取り消す
                  </button>
                </>
              )}
            </div>
          ) : asking ? (
            <div className="mt-1">
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder="ひとこと（任意）例：手作り味噌が2kgあります。明日発送できます"
                className="w-full rounded-lg border p-2 text-[13px] outline-none focus:border-[#d96a1a]"
                style={{ borderColor: "#e8dcc4" }}
              />
              <div className="mt-1 flex justify-end gap-2">
                <button onClick={() => setAsking(false)} className="px-3 py-1.5 text-[12px] text-[#a09888]">やめる</button>
                <button
                  onClick={offerHelp}
                  disabled={busy}
                  className="rounded-full px-4 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-50"
                  style={{ background: "#d96a1a" }}
                >
                  応援を申し出る
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => (userId ? setAsking(true) : requireJoin())}
              className="rounded-full px-3.5 py-1.5 text-[13px] font-extrabold text-white"
              style={{ background: "#2e7d4f" }}
            >
              🙌 私が応援します
            </button>
          )}
        </div>
      )}

      {/* 投稿主/管理者: 応援者一覧・応援完了 */}
      {(isOwner || isAdmin) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setOpen(!open)}
            className="rounded-full border px-3 py-1 text-[12px] font-bold"
            style={{ borderColor: "#e8dcc4", color: "#5a5448", background: "#fff" }}
          >
            応援者 {pending + accepted}人 {open ? "△" : "▽"}
          </button>
          <button
            onClick={async () => {
              const next = done ? "open" : "done";
              if (!window.confirm(next === "done" ? "「応援完了」にしますか？（届いた印です。写真に応援完了のたすきが付き、募集を終了します）" : "応援完了を取り消して、募集中に戻しますか？")) return;
              await setBoardStatus(message.id, next);
              onChanged();
            }}
            className="rounded-full px-3 py-1 text-[12px] font-bold text-white"
            style={{ background: done ? "#a09888" : "#c05e14" }}
          >
            {done ? "応援完了を取り消す" : "✅ 届きました（応援完了）"}
          </button>
        </div>
      )}
      {open && (isOwner || isAdmin) && (
        <div className="mt-2 space-y-1.5">
          {list === null ? (
            <p className="text-[12px] text-[#a09888]">読み込み中…</p>
          ) : list.length === 0 ? (
            <p className="text-[12px] text-[#a09888]">まだ手を挙げた人はいません</p>
          ) : (
            list.map((r) => (
              <div key={r.id} className="flex items-start gap-2 rounded-lg bg-white px-2 py-1.5" style={{ border: "1px solid #f0e6d2" }}>
                <Link href={`/u/${r.user_id}`} className="shrink-0">
                  <Avatar name={r.profiles?.display_name ?? "参加者"} url={r.profiles?.avatar_url} size={30} />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-bold text-[#3a3428]">
                    {r.profiles?.display_name ?? "参加者"}
                    {r.status === "accepted" && <span className="ml-1.5 text-[11px]" style={{ color: "#2e7d4f" }}>✅ お願い済み</span>}
                    {r.status === "declined" && <span className="ml-1.5 text-[11px] text-[#a09888]">見送り</span>}
                  </p>
                  {r.message && <p className="whitespace-pre-wrap text-[12px] text-[#5a5448]">{r.message}</p>}
                </div>
                {r.status === "pending" && !done && isOwner && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <button onClick={() => decide(r, "accepted")} disabled={busy} className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50" style={{ background: "#2e7d4f" }}>
                      この人にお願いする
                    </button>
                    <button onClick={() => decide(r, "declined")} disabled={busy} className="rounded-full border px-2.5 py-1 text-[11px] font-bold text-[#a09888]" style={{ borderColor: "#e8dcc4" }}>
                      見送る
                    </button>
                  </div>
                )}
                {r.status === "accepted" && userId && isOwner && (
                  <button
                    onClick={async () => {
                      const chatId = await getOrCreateChat(userId, r.user_id);
                      if (chatId) router.push(`/talk/${chatId}`);
                    }}
                    className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
                    style={{ background: "#d96a1a" }}
                  >
                    TalK
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

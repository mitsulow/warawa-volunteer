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
 * - 見る人: 🙌 私が応援します → その瞬間に成立（1人だけ）。写真は白黒＋「現在やり取り中」になり、他の人は押せない（重複送付の防止）
 *   自動で友達承認されるので、すぐTalKで送り先などを相談できる
 * - 投稿主: 応援者を確認・TalK。決裂したら「違う人に応援を求める」→ 募集中に戻る
 * - 投稿主/管理者: TalKでの取引が完了したら「応援完了」（「応援完了」のたすき）
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
  const active = (counts?.pending ?? 0) + (counts?.accepted ?? 0) > 0; // 現在やり取り中
  const [list, setList] = useState<VoiceSupport[] | null>(null);
  const [asking, setAsking] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if ((isOwner || isAdmin) && active) fetchVoiceSupportsFor(message.id).then(setList);
    else setList(null);
  }, [isOwner, isAdmin, active, message.id, counts?.accepted, counts?.pending]);

  const current = list?.find((r) => r.status === "accepted" || r.status === "pending") ?? null;
  const myActive = mySupport && (mySupport.status === "accepted" || mySupport.status === "pending") ? mySupport : null;

  const offerHelp = async () => {
    if (!userId) {
      requireJoin();
      return;
    }
    if (busy) return;
    if (!window.confirm("この「助けて」に応援しますか？\n押すとあなたに決まり（他の人は応援できなくなります）、投稿主とTalKで送り先などを相談できます。")) return;
    setBusy(true);
    const { error } = await sendVoiceSupport(message.id, userId, msg);
    setBusy(false);
    if (error) {
      window.alert("送れませんでした（すでに他の方がやり取り中か、受付が終了しています）");
      onChanged();
      return;
    }
    setAsking(false);
    setMsg("");
    onChanged();
  };

  const release = async () => {
    if (!current || busy) return;
    if (!window.confirm(`${current.profiles?.display_name ?? "この方"}さんとのやり取りをいったん終えて、違う人に応援を求めますか？\n（投稿は募集中に戻り、また「私が応援します」を押せるようになります）`)) return;
    setBusy(true);
    await respondVoiceSupport(current.id, "declined");
    setBusy(false);
    onChanged();
  };

  return (
    <div className="mt-2 rounded-xl border px-3 py-2" style={{ borderColor: "#f0e6d2", background: "#fffdf8" }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <span className="font-bold" style={{ color: done ? "#a09888" : active ? "#c05e14" : "#2e7d4f" }}>
          {done ? "✅ 応援完了" : active ? "🔄 現在やり取り中" : "🙌 応援を待っています"}
        </span>
      </div>

      {/* 見る人 */}
      {!isOwner && !done && (
        <div className="mt-2">
          {myActive ? (
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <span className="font-bold" style={{ color: "#2e7d4f" }}>✅ あなたが応援中です</span>
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
              <button
                onClick={async () => {
                  if (!window.confirm("応援を取り下げますか？（投稿は募集中に戻ります）")) return;
                  await cancelVoiceSupport(myActive.id);
                  onChanged();
                }}
                className="text-[11.5px] text-[#a09888] underline"
              >
                取り下げる
              </button>
            </div>
          ) : active ? (
            <p className="text-[12px] text-[#a09888]">他の方がやり取り中のため、いまは応援できません</p>
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
                  style={{ background: "#2e7d4f" }}
                >
                  私が応援します
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

      {/* 投稿主/管理者 */}
      {(isOwner || isAdmin) && (
        <div className="mt-2">
          {active && (
            <div className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5" style={{ border: "1px solid #f0e6d2" }}>
              {current ? (
                <>
                  <Link href={`/u/${current.user_id}`} className="shrink-0">
                    <Avatar name={current.profiles?.display_name ?? "参加者"} url={current.profiles?.avatar_url} size={30} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-bold text-[#3a3428]">{current.profiles?.display_name ?? "参加者"} さんが応援中</p>
                    {current.message && <p className="whitespace-pre-wrap text-[12px] text-[#5a5448]">{current.message}</p>}
                  </div>
                  {userId && isOwner && (
                    <button
                      onClick={async () => {
                        const chatId = await getOrCreateChat(userId, current.user_id);
                        if (chatId) router.push(`/talk/${chatId}`);
                      }}
                      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
                      style={{ background: "#d96a1a" }}
                    >
                      TalK
                    </button>
                  )}
                </>
              ) : (
                <p className="text-[12px] text-[#a09888]">応援者を読み込み中…</p>
              )}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {active && !done && (
              <button
                onClick={release}
                disabled={busy || !current}
                className="rounded-full border px-3 py-1 text-[12px] font-bold disabled:opacity-50"
                style={{ borderColor: "#c0392b", color: "#c0392b", background: "#fff" }}
              >
                違う人に応援を求める
              </button>
            )}
            <button
              onClick={async () => {
                const next = done ? "open" : "done";
                if (!window.confirm(next === "done" ? "「応援完了」にしますか？\nTalKでのやり取り（取引）がお互いに完了した時点で押してください。写真に応援完了のたすきが付き、募集を終了します。" : "応援完了を取り消して、募集中に戻しますか？")) return;
                await setBoardStatus(message.id, next);
                onChanged();
              }}
              className="rounded-full px-3 py-1 text-[12px] font-bold text-white"
              style={{ background: done ? "#a09888" : "#c05e14" }}
            >
              {done ? "応援完了を取り消す" : "✅ 応援完了にする"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

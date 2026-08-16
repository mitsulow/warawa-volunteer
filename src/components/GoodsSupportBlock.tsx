"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  cancelGoodsRequest,
  fetchGoodsRequestsFor,
  getOrCreateChat,
  respondGoodsRequest,
  sendGoodsRequest,
  setOfferDone,
  type GoodsRequest,
  type Offer,
} from "@/lib/db";
import { Avatar } from "@/components/Avatar";

/* eslint-disable @next/next/no-img-element */

export const ROUTE_LABEL: Record<Offer["route"], string> = {
  orange: "🟠 避難所や炊き出し所などにまとめて送る",
  direct: "🤝 個人間で直接送る",
  both: "🟠🤝 両方可能（避難所へも個人間でも）",
};

/**
 * 物資カードの「届け方」ブロック（楽市楽座のブツブツ交換を簡素化して移植）。
 * - 全員: 届け方バッジ・数量・送り先の残り数
 * - 個人的に支援(direct/both): 見る人は「受け取りを希望する」、投稿主は希望者一覧→「この人に決めた」→自動で友達承認→TalK
 * - 投稿主/管理者: 「応援完了」の切替（SOLD OUT相当のスタンプ）
 */
export function GoodsSupportBlock({
  offer,
  userId,
  isAdmin,
  counts,
  myRequest,
  requireJoin,
  onChanged,
}: {
  offer: Offer;
  userId: string | null;
  isAdmin: boolean;
  counts?: { pending: number; accepted: number };
  myRequest?: GoodsRequest | null;
  requireJoin: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const isOwner = !!userId && userId === offer.user_id;
  const direct = offer.route === "direct" || offer.route === "both";
  const accepted = counts?.accepted ?? 0;
  const pending = counts?.pending ?? 0;
  const remaining = Math.max(0, offer.slots - accepted);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<GoodsRequest[] | null>(null);
  const [asking, setAsking] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && isOwner) fetchGoodsRequestsFor(offer.id).then(setList);
  }, [open, isOwner, offer.id]);

  if (offer.kind !== "goods") return null;

  const ask = async () => {
    if (!userId) {
      requireJoin();
      return;
    }
    if (busy) return;
    setBusy(true);
    const { error } = await sendGoodsRequest(offer.id, userId, msg);
    setBusy(false);
    if (error) {
      window.alert("送れませんでした（すでに希望済み、または受付終了の可能性があります）");
      return;
    }
    setAsking(false);
    setMsg("");
    onChanged();
  };

  const decide = async (r: GoodsRequest, status: "accepted" | "declined") => {
    if (busy) return;
    const q =
      status === "accepted"
        ? `${r.profiles?.display_name ?? "この方"}さんに決めますか？\n決めると友達として登録され、TalKで受け渡しの相談ができます。${
            accepted + 1 >= offer.slots ? "\n（これで送り先の枠が埋まり「応援完了」になります）" : ""
          }`
        : "この希望を見送りますか？";
    if (!window.confirm(q)) return;
    setBusy(true);
    await respondGoodsRequest(r.id, status);
    setBusy(false);
    setList(null);
    fetchGoodsRequestsFor(offer.id).then(setList);
    onChanged();
  };

  return (
    <div className="mt-2 rounded-xl border px-3 py-2" style={{ borderColor: "#f0e6d2", background: "#fffdf8" }}>
      {/* 届け方 + 数量 + 残り枠 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <span className="font-bold text-[#5a5448]">{ROUTE_LABEL[offer.route]}</span>
        {offer.quantity && (
          <span className="text-[#5a5448]">
            数量：<b>{offer.quantity}</b>
          </span>
        )}
        {direct && (
          <span className={offer.done ? "text-[#a09888]" : "font-bold"} style={offer.done ? undefined : { color: "#2e7d4f" }}>
            {offer.done ? "受付終了" : `送り先 あと${remaining}か所`}
            {pending > 0 && !offer.done ? `・希望${pending}人` : ""}
          </span>
        )}
      </div>

      {/* 見る人: 受け取り希望 */}
      {direct && !isOwner && !offer.done && (
        <div className="mt-2">
          {myRequest ? (
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
              {myRequest.status === "accepted" ? (
                <>
                  <span className="font-bold" style={{ color: "#2e7d4f" }}>✅ あなたに決まりました</span>
                  {userId && (
                    <button
                      onClick={async () => {
                        const chatId = await getOrCreateChat(userId, offer.user_id);
                        if (chatId) router.push(`/talk/${chatId}`);
                      }}
                      className="rounded-full px-3 py-1 text-[11.5px] font-bold text-white"
                      style={{ background: "#d96a1a" }}
                    >
                      TalKで相談する
                    </button>
                  )}
                </>
              ) : myRequest.status === "declined" ? (
                <span className="text-[#a09888]">今回は見送りになりました</span>
              ) : (
                <>
                  <span className="text-[#8a7a5a]">希望を送りました（返事待ち）</span>
                  <button
                    onClick={async () => {
                      if (!window.confirm("希望を取り消しますか？")) return;
                      await cancelGoodsRequest(myRequest.id);
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
                placeholder="ひとこと（任意）例：〇〇市の避難所で3世帯分ほしいです"
                className="w-full rounded-lg border p-2 text-[13px] outline-none focus:border-[#d96a1a]"
                style={{ borderColor: "#e8dcc4" }}
              />
              <div className="mt-1 flex justify-end gap-2">
                <button onClick={() => setAsking(false)} className="px-3 py-1.5 text-[12px] text-[#a09888]">やめる</button>
                <button
                  onClick={ask}
                  disabled={busy}
                  className="rounded-full px-4 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-50"
                  style={{ background: "#d96a1a" }}
                >
                  希望を送る
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => (userId ? setAsking(true) : requireJoin())}
              className="rounded-full border px-3 py-1.5 text-[12.5px] font-extrabold"
              style={{ borderColor: "#2e7d4f", color: "#2e7d4f", background: "#fff" }}
            >
              🙋 受け取りを希望する
            </button>
          )}
        </div>
      )}

      {/* 投稿主: 希望者一覧と応援完了 */}
      {(isOwner || isAdmin) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {direct && (
            <button
              onClick={() => setOpen(!open)}
              className="rounded-full border px-3 py-1 text-[12px] font-bold"
              style={{ borderColor: "#e8dcc4", color: "#5a5448", background: "#fff" }}
            >
              希望者 {pending + accepted}人 {open ? "△" : "▽"}
            </button>
          )}
          <button
            onClick={async () => {
              const next = !offer.done;
              if (!window.confirm(next ? "「応援完了」にしますか？\nTalKでのやり取り（取引）がお互いに完了した時点で押してください。写真に応援完了のスタンプが付き、受付を終了します。" : "応援完了を取り消して、受付中に戻しますか？")) return;
              await setOfferDone(offer.id, next);
              onChanged();
            }}
            className="rounded-full px-3 py-1 text-[12px] font-bold text-white"
            style={{ background: offer.done ? "#a09888" : "#c05e14" }}
          >
            {offer.done ? "応援完了を取り消す" : "✅ 応援完了にする"}
          </button>
        </div>
      )}
      {open && isOwner && (
        <div className="mt-2 space-y-1.5">
          {list === null ? (
            <p className="text-[12px] text-[#a09888]">読み込み中…</p>
          ) : list.length === 0 ? (
            <p className="text-[12px] text-[#a09888]">まだ希望者はいません</p>
          ) : (
            list.map((r) => (
              <div key={r.id} className="flex items-start gap-2 rounded-lg bg-white px-2 py-1.5" style={{ border: "1px solid #f0e6d2" }}>
                <Link href={`/u/${r.user_id}`} className="shrink-0">
                  <Avatar name={r.profiles?.display_name ?? "参加者"} url={r.profiles?.avatar_url} size={30} />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-bold text-[#3a3428]">
                    {r.profiles?.display_name ?? "参加者"}
                    {r.status === "accepted" && <span className="ml-1.5 text-[11px]" style={{ color: "#2e7d4f" }}>✅ 決定</span>}
                    {r.status === "declined" && <span className="ml-1.5 text-[11px] text-[#a09888]">見送り</span>}
                  </p>
                  {r.message && <p className="whitespace-pre-wrap text-[12px] text-[#5a5448]">{r.message}</p>}
                </div>
                {r.status === "pending" && !offer.done && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <button onClick={() => decide(r, "accepted")} disabled={busy} className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50" style={{ background: "#2e7d4f" }}>
                      この人に決めた
                    </button>
                    <button onClick={() => decide(r, "declined")} disabled={busy} className="rounded-full border px-2.5 py-1 text-[11px] font-bold text-[#a09888]" style={{ borderColor: "#e8dcc4" }}>
                      見送る
                    </button>
                  </div>
                )}
                {r.status === "accepted" && userId && (
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

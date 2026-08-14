"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchBoard,
  fetchBoardSince,
  fetchFeedLikes,
  fetchOffers,
  markGroupRead,
  sendBoardMessage,
  toggleFeedLike,
  uploadPhoto,
  type BoardMessage,
  type Offer,
} from "@/lib/db";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";

/* eslint-disable @next/next/no-img-element */

/** ハート: 白抜き→いいねで赤（OneSea CotoZuteのThreads型と同じ文法） */
function IcoHeart({ on }: { on: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={on ? "#e8384f" : "none"} stroke={on ? "#e8384f" : "#0abab5"} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "fill .12s, stroke .12s" }}>
      <path d="M12 20.4C7 17.2 3.4 13.9 3.4 9.8c0-2.7 2.1-4.7 4.6-4.7 1.7 0 3.3 1 4 2.5.7-1.5 2.3-2.5 4-2.5 2.5 0 4.6 2 4.6 4.7 0 4.1-3.6 7.4-8.6 10.6z" />
    </svg>
  );
}

function IcoBubble() {
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#0abab5" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4.4c4.8 0 8.3 2.9 8.3 6.8s-3.5 6.8-8.3 6.8c-.9 0-1.7-.1-2.5-.3l-3.9 1.8 1-3.4c-1.8-1.2-2.9-3-2.9-4.9 0-3.9 3.5-6.8 8.3-6.8z" />
    </svg>
  );
}

function relTime(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "たった今";
  if (s < 3600) return `${Math.floor(s / 60)}分前`;
  if (s < 86400) return `${Math.floor(s / 3600)}時間前`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}日前`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

interface FeedItem {
  key: string;
  userId: string;
  name: string;
  avatar: string | null;
  createdAt: string;
  chip: string | null; // 取り組みの種類ラベル
  body: string;
  image: string | null;
}

/**
 * 取り組みフィード（OneSea CotoZuteと同じカード文法のThreads型フィード）。
 * 掲示板の書き込みと「私にできる事」の意思表明を1本の時系列に混ぜてライブ参照する。
 * 掲示板は5秒増分ポーリング、意思表明は60秒ごと。
 */
export function ActivityFeed({
  userId,
  requireJoin,
}: {
  userId: string | null;
  requireJoin: () => void;
}) {
  const router = useRouter();
  const [boards, setBoards] = useState<BoardMessage[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [likeCounts, setLikeCounts] = useState<Map<string, number>>(new Map());
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 掲示板: 増分ポーリング（OneSea鉄則）
  useEffect(() => {
    let alive = true;
    fetchBoard("board").then((rows) => {
      if (!alive) return;
      setBoards(rows);
      if (rows.length) cursorRef.current = rows[rows.length - 1].created_at;
      if (userId) markGroupRead("board", userId);
    });
    const timer = setInterval(async () => {
      if (document.hidden || !cursorRef.current) return;
      const fresh = await fetchBoardSince("board", cursorRef.current);
      if (!alive || fresh.length === 0) return;
      cursorRef.current = fresh[fresh.length - 1].created_at;
      setBoards((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
      });
      if (userId) markGroupRead("board", userId);
    }, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [userId]);

  // 意思表明: 60秒ごと
  useEffect(() => {
    let alive = true;
    const load = () => fetchOffers().then((o) => alive && setOffers(o));
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 60000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // フィード合成（新しい順）
  const items: FeedItem[] = [
    ...boards.map((m) => ({
      key: `board:${m.id}`,
      userId: m.user_id,
      name: m.profiles?.display_name ?? "参加者",
      avatar: m.profiles?.avatar_url ?? null,
      createdAt: m.created_at,
      chip: null,
      body: m.body,
      image: m.image_url,
    })),
    ...offers.map((o) => ({
      key: `offer:${o.id}`,
      userId: o.user_id,
      name: o.profiles?.display_name ?? "参加者",
      avatar: o.profiles?.avatar_url ?? null,
      createdAt: o.created_at,
      chip:
        o.kind === "money"
          ? "💰 お金を出します"
          : o.kind === "goods"
            ? "🍚 物資を出します"
            : o.status === "confirmed"
              ? "🟠 現地入りメンバー"
              : "🏃 現地入り申請中",
      body: o.kind === "goods" && o.title ? `${o.title}\n${o.detail}` : o.detail,
      image: o.image_url,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // いいね読み込み（表示中のキーだけ）
  useEffect(() => {
    const keys = items.map((i) => i.key);
    if (keys.length === 0) return;
    fetchFeedLikes(keys.slice(0, 100), userId).then(({ counts, mine }) => {
      setLikeCounts(counts);
      setMyLikes(mine);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boards.length, offers.length, userId]);

  const like = async (key: string) => {
    if (!userId) {
      requireJoin();
      return;
    }
    const on = !myLikes.has(key);
    setMyLikes((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
    setLikeCounts((prev) => {
      const next = new Map(prev);
      next.set(key, Math.max(0, (next.get(key) ?? 0) + (on ? 1 : -1)));
      return next;
    });
    await toggleFeedLike(key, userId, on);
  };

  const send = async (imageUrl?: string | null) => {
    if (!userId) {
      requireJoin();
      return;
    }
    const text = body.trim();
    if (!text && !imageUrl) return;
    setBusy(true);
    await sendBoardMessage("board", userId, text, imageUrl);
    setBody("");
    setBusy(false);
    const fresh = await fetchBoardSince("board", cursorRef.current ?? "1970-01-01");
    if (fresh.length) {
      cursorRef.current = fresh[fresh.length - 1].created_at;
      setBoards((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
      });
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;
    setBusy(true);
    const url = await uploadPhoto(file, userId);
    setBusy(false);
    if (url) await send(url);
  };

  return (
    <div>
      {/* 書き込み欄 */}
      <div className="mb-3 flex gap-2">
        <button
          className="rounded-xl border border-[#e0d6c6] bg-white px-3 text-xl"
          onClick={() => (userId ? fileRef.current?.click() : requireJoin())}
          disabled={busy}
          aria-label="写真を送る"
        >
          📷
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={onFile}
        />
        <input
          className="flex-1 rounded-xl border border-[#e0d6c6] bg-white px-3 py-2 text-[14px]"
          placeholder={userId ? "いまの取り組みを書く" : "ログインすると書き込めます"}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          className="rounded-xl px-4 font-bold text-white disabled:opacity-50"
          style={{ background: "#d96a1a" }}
          disabled={busy}
          onClick={() => send()}
        >
          送信
        </button>
      </div>

      {/* フィード（CotoZuteカード） */}
      <div className="space-y-2.5">
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#e0d6c6] bg-white py-8 text-center text-sm text-[#a09888]">
            まだ取り組みがありません。最初のひとことをどうぞ
          </p>
        )}
        {items.slice(0, 80).map((it) => (
          <div key={it.key} className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Link href={`/u/${it.userId}`}>
                <Avatar name={it.name} url={it.avatar} size={36} />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-[13.5px] font-bold leading-tight text-[#1c1e21]">
                  <span className="truncate">{it.name}</span>
                  <VerifiedBadge size={13} />
                  <span className="ml-1 shrink-0 text-[11px] font-normal text-[#a09888]">
                    {relTime(it.createdAt)}
                  </span>
                </p>
                {it.chip && (
                  <span
                    className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: "#fdf0e0", color: "#c05e14", border: "1px solid #f0d0a8" }}
                  >
                    {it.chip}
                  </span>
                )}
              </div>
            </div>
            {it.body && (
              <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#1c1e21]">
                {it.body}
              </p>
            )}
            {it.image && (
              <img
                src={it.image}
                alt=""
                className="mt-2 max-h-80 w-full rounded-lg object-cover"
              />
            )}
            {/* アイコン行（左寄せ・ハート/吹き出し） */}
            <div className="mt-2 flex items-center gap-4">
              <button className="flex items-center gap-1" onClick={() => like(it.key)} aria-label="いいね">
                <IcoHeart on={myLikes.has(it.key)} />
                {(likeCounts.get(it.key) ?? 0) > 0 && (
                  <span className="num text-[12.5px] font-bold text-[#8a8070]">
                    {likeCounts.get(it.key)}
                  </span>
                )}
              </button>
              <button
                className="flex items-center gap-1"
                onClick={() =>
                  it.key.startsWith("board:")
                    ? router.push("/talk/g/board")
                    : router.push(`/u/${it.userId}`)
                }
                aria-label="話す"
              >
                <IcoBubble />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

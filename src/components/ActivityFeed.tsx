"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchBoard,
  fetchBoardSince,
  fetchCommentCounts,
  fetchFeedLikes,
  fetchOffers,
  markGroupRead,
  toggleFeedLike,
  type BoardMessage,
  type Offer,
} from "@/lib/db";
import { CommentSection } from "@/components/CommentSection";
import { deleteBoardMessage, deleteOffer } from "@/lib/db";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { EmbedCard, type OGPEmbed } from "@/components/EmbedCard";
import { DotsMenu } from "@/components/PostKit";
import { PostComposer } from "@/components/PostComposer";
import { ReportDialog } from "@/components/ReportDialog";

/* eslint-disable @next/next/no-img-element */

/* ============ CotoZuteと同じアイコン文法 ============ */

function IcoHeart({ on }: { on: boolean }) {
  return (
    <svg width="27" height="27" viewBox="0 0 24 24" fill={on ? "#e8384f" : "none"} stroke={on ? "#e8384f" : "#d96a1a"} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "fill .12s, stroke .12s" }}>
      <path d="M12 20.4C7 17.2 3.4 13.9 3.4 9.8c0-2.7 2.1-4.7 4.6-4.7 1.7 0 3.3 1 4 2.5.7-1.5 2.3-2.5 4-2.5 2.5 0 4.6 2 4.6 4.7 0 4.1-3.6 7.4-8.6 10.6z" />
    </svg>
  );
}

function IcoBubble() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#d96a1a" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
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

/* ============ フィード ============ */

interface FeedItem {
  key: string;
  userId: string;
  name: string;
  avatar: string | null;
  memberNo: number | null;
  createdAt: string;
  chip: string | null;
  body: string;
  images: string[]; // 本体
  thumbs: string[]; // サムネ
  embed: OGPEmbed | null;
}

/**
 * 取り組みフィード（OneSea CotoZuteページと同じ挙動・見た目）。
 * 掲示板の投稿と「助けたい」の意思表明を1本の時系列にライブ参照で混ぜる。
 */
export function ActivityFeed({
  userId,
  myAvatar = null,
  isAdmin = false,
  requireJoin,
}: {
  userId: string | null;
  myAvatar?: string | null;
  isAdmin?: boolean;
  requireJoin: () => void;
}) {
  const router = useRouter();
  const [boards, setBoards] = useState<BoardMessage[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [likeCounts, setLikeCounts] = useState<Map<string, number>>(new Map());
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [expandedBody, setExpandedBody] = useState<Set<string>>(new Set());
  const [commentCounts, setCommentCounts] = useState<Map<string, number>>(new Map());
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [imgIdx, setImgIdx] = useState<Map<string, number>>(new Map());
  const [lightbox, setLightbox] = useState<{ urls: string[]; idx: number } | null>(null);
  const [report, setReport] = useState<{ key: string; excerpt: string } | null>(null);
  const cursorRef = useRef<string | null>(null);

  const pullBoard = async () => {
    const fresh = await fetchBoardSince("board", cursorRef.current ?? "1970-01-01");
    if (fresh.length) {
      cursorRef.current = fresh[fresh.length - 1].created_at;
      setBoards((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
      });
    }
  };

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
      await pullBoard();
      if (userId) markGroupRead("board", userId);
    }, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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

  const items: FeedItem[] = [
    ...boards.map((m) => ({
      key: `board:${m.id}`,
      userId: m.user_id,
      name: m.profiles?.display_name ?? "参加者",
      avatar: m.profiles?.avatar_url ?? null,
      memberNo: m.profiles?.member_no ?? null,
      createdAt: m.created_at,
      chip: null,
      body: m.body,
      images: m.image_urls?.length ? m.image_urls : m.image_url ? [m.image_url] : [],
      thumbs: m.thumb_urls?.length ? m.thumb_urls : m.image_url ? [m.image_url] : [],
      embed: (m.embed as OGPEmbed | null) ?? null,
    })),
    // フィードに並ぶのは物資とその他だけ（体=事務局申請のみ・お金=案内のみ）
    ...offers
      .filter((o) => o.kind === "goods" || o.kind === "other")
      .map((o) => ({
        key: `offer:${o.id}`,
        userId: o.user_id,
        name: o.profiles?.display_name ?? "参加者",
        avatar: o.profiles?.avatar_url ?? null,
        memberNo: o.profiles?.member_no ?? null,
        createdAt: o.created_at,
        chip: o.kind === "goods" ? "物資を出します" : "持ち寄ります",
        body: o.kind === "goods" && o.title ? `${o.title}\n${o.detail}` : o.detail,
        images: o.image_urls?.length ? o.image_urls : o.image_url ? [o.image_url] : [],
        thumbs: o.thumb_urls?.length ? o.thumb_urls : o.image_url ? [o.image_url] : [],
        embed: null,
      })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  useEffect(() => {
    const keys = items.map((i) => i.key).slice(0, 100);
    if (keys.length === 0) return;
    fetchFeedLikes(keys, userId).then(({ counts, mine }) => {
      setLikeCounts(counts);
      setMyLikes(mine);
    });
    fetchCommentCounts(keys).then(setCommentCounts);
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

  const needsFold = (b: string) => b.length > 60 || b.includes("\n");

  const removeItem = async (it: FeedItem) => {
    if (!window.confirm("この投稿を削除しますか？")) return;
    const [t, rawId] = it.key.split(":");
    if (t === "board") {
      await deleteBoardMessage(rawId);
      setBoards((prev) => prev.filter((m) => m.id !== rawId));
    } else {
      await deleteOffer(rawId);
      setOffers((prev) => prev.filter((o) => o.id !== rawId));
    }
  };

  return (
    <div>
      <PostComposer
        scope="board"
        prompt="書き込む"
        userId={userId}
        myAvatar={myAvatar}
        requireJoin={requireJoin}
        onPosted={pullBoard}
      />

      {/* 中央フィード（CotoZuteと同じ白い列・左右いっぱいの写真） */}
      <div className="space-y-2.5">
        {items.length === 0 && (
          <p className="py-12 text-center text-[13px] text-[#8a8d91]">
            まだ取り組みがありません。最初のひとことをどうぞ
          </p>
        )}
        {items.slice(0, 80).map((it) => {
          const bodyExpanded = expandedBody.has(it.key);
          const idx = imgIdx.get(it.key) ?? 0;
          return (
            <div
              key={it.key}
              className="overflow-hidden rounded-2xl shadow-sm"
              style={{ background: "linear-gradient(160deg,#f2a35c,#e0803a)", padding: "5px 5px 0" }}
            >
              <div className="relative overflow-hidden rounded-xl bg-white px-3 py-2.5">
                <div className="relative">
                {/* ヘッダー */}
                <div className="flex items-center gap-2.5">
                  <Link href={`/u/${it.userId}`} className="flex-shrink-0">
                    <Avatar name={it.name} url={it.avatar} size={40} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/u/${it.userId}`}
                      className="flex max-w-full items-center gap-1 truncate text-left text-[14.5px] font-bold leading-tight text-[#1c1e21] no-underline"
                    >
                      {it.name}
                      <VerifiedBadge size={14} />
                    </Link>
                    <div className="text-[11.5px] leading-tight text-[#8a8d91]">
                      {relTime(it.createdAt)}
                      {it.memberNo != null && (
                        <span className="num ml-1.5">@ボランティアNo.{it.memberNo}</span>
                      )}
                    </div>
                  </div>
                  {it.chip && (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: "#fdf0e0", color: "#c05e14", border: "1px solid #f0d0a8" }}
                    >
                      {it.chip}
                    </span>
                  )}
                  {userId && (
                    <DotsMenu
                      canEdit={userId === it.userId || isAdmin}
                      onEdit={() => {
                        const [t, rawId] = it.key.split(":");
                        router.push(`/post/${t}/${rawId}?edit=1`);
                      }}
                      onDelete={() => removeItem(it)}
                      onReport={() => setReport({ key: it.key, excerpt: it.body })}
                    />
                  )}
                </div>

                {/* 本文（1行 → もっと見る → 折りたたむ・CotoZuteと同じ） */}
                {it.body.trim() && (
                  <div className="mt-2">
                    <p
                      className={`whitespace-pre-wrap break-words text-[16px] leading-relaxed text-[#1c1e21] ${
                        bodyExpanded || !needsFold(it.body) ? "" : "line-clamp-1"
                      }`}
                      onClick={() => {
                        if (needsFold(it.body) && !bodyExpanded)
                          setExpandedBody((p) => new Set(p).add(it.key));
                      }}
                    >
                      {it.body}
                    </p>
                    {needsFold(it.body) && !bodyExpanded && (
                      <button
                        onClick={() => setExpandedBody((p) => new Set(p).add(it.key))}
                        className="text-[13.5px] text-[#8a8d91]"
                      >
                        …もっと見る
                      </button>
                    )}
                  </div>
                )}

                {/* 埋め込み（SNSリンク） */}
                {it.embed && (
                  <div className="mt-2">
                    <EmbedCard embed={it.embed} />
                  </div>
                )}

                {/* 写真（左右いっぱい）。複数枚はインスタ式: 横スワイプ+●ドット */}
                {it.images.length === 1 && (
                  <div className="-mx-3 mt-2">
                    <button
                      onClick={() => setLightbox({ urls: it.images, idx: 0 })}
                      className="block w-full"
                      aria-label="写真をフル画質で見る"
                    >
                      <img src={it.thumbs[0] ?? it.images[0]} alt="" className="w-full object-cover" />
                    </button>
                  </div>
                )}
                {it.images.length > 1 && (
                  <div className="-mx-3 mt-2">
                    <div
                      className="hide-scrollbar flex snap-x snap-mandatory overflow-x-auto"
                      onScroll={(e) => {
                        const el = e.currentTarget;
                        const i = Math.round(el.scrollLeft / el.clientWidth);
                        if (i !== idx)
                          setImgIdx((p) => new Map(p).set(it.key, i));
                      }}
                    >
                      {it.images.map((full, i) => (
                        <button
                          key={full}
                          onClick={() => setLightbox({ urls: it.images, idx: i })}
                          className="w-full flex-shrink-0 snap-center"
                          aria-label={`写真${i + 1}`}
                        >
                          <img
                            src={it.thumbs[i] ?? full}
                            alt=""
                            className="h-full w-full object-cover"
                            style={{ aspectRatio: "1" }}
                          />
                        </button>
                      ))}
                    </div>
                    <div className="mt-1.5 flex justify-center gap-1">
                      {it.images.map((_, i) => (
                        <span
                          key={i}
                          className="rounded-full"
                          style={{
                            width: 6,
                            height: 6,
                            background: i === idx ? "#d96a1a" : "#d8d4c8",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* アイコン行（左寄せ・CotoZuteと同じ） */}
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
                      setOpenComments((prev) => {
                        const next = new Set(prev);
                        if (next.has(it.key)) next.delete(it.key);
                        else next.add(it.key);
                        return next;
                      })
                    }
                    aria-label="コメント"
                  >
                    <IcoBubble />
                    {(commentCounts.get(it.key) ?? 0) > 0 && (
                      <span className="num text-[12.5px] font-bold text-[#8a8070]">
                        {commentCounts.get(it.key)}
                      </span>
                    )}
                  </button>
                </div>
                {openComments.has(it.key) && (
                  <CommentSection
                    itemKey={it.key}
                    userId={userId}
                    requireJoin={requireJoin}
                    onAdded={() =>
                      setCommentCounts((prev) => {
                        const next = new Map(prev);
                        next.set(it.key, (next.get(it.key) ?? 0) + 1);
                        return next;
                      })
                    }
                  />
                )}
                </div>
                {/* 透かしワラエル: 左に少し倒す。写真ありは写真の上に重なる */}
                <img
                  src="/waraeru-v2.png"
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute -right-4 h-32 w-32 object-contain"
                  style={{
                    opacity: it.images.length > 0 ? 0.55 : 0.12,
                    bottom: -6,
                    transform: "rotate(-8deg)",
                  }}
                />
              </div>
              <div className="flex h-[24px] items-center justify-end pr-2.5">
                <img src="/warawa-logo.png" alt="わらわ〜" className="h-[16px] w-auto object-contain" />
              </div>
            </div>
          );
        })}
      </div>

      {/* 通報（→事務局/officeの通報受信箱へ届く） */}
      {report && userId && (
        <ReportDialog
          itemKey={report.key}
          excerpt={report.excerpt}
          meId={userId}
          onClose={() => setReport(null)}
        />
      )}

      {/* ライトボックス（タップでフル画質） */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-3"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox.urls[lightbox.idx]}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
          <button
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

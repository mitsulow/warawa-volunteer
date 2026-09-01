"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchBoard,
  fetchBoardSince,
  fetchPinnedBoard,
  setBoardPinned,
  fetchCommentCounts,
  fetchFeedLikes,
  fetchLikersFor,
  markGroupRead,
  toggleFeedLike,
  type BoardMessage,
  type Liker,
} from "@/lib/db";
import { CommentSection } from "@/components/CommentSection";
import { Linkify } from "@/components/Linkify";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { Lightbox } from "@/components/Lightbox";
import { deleteBoardMessage } from "@/lib/db";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { EmbedCard, type OGPEmbed } from "@/components/EmbedCard";
import { DotsMenu } from "@/components/PostKit";
import { PostComposer } from "@/components/PostComposer";
import { ReportDialog } from "@/components/ReportDialog";
import { ORANGE_LEADER_ID } from "@/lib/config";

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

/** JSTの日付見出し（現地報告の日付別アルバム用）: 「9月1日(月)」 */
function jstDay(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Tokyo",
  });
}

/** 現地報告タブ最上部のヒーロー・スライドショー。
 * ネイティブ横スクロール+スナップ（Lightbox/ポスターと同方式）なので写真が指に付いてくる。
 * 3.5秒の自動送りはスムーズスクロールで、指を触れたら6秒お休み。タップで拡大 */
function ReportHero({
  shots,
  onOpen,
}: {
  shots: Array<{ url: string; thumb: string; name: string; date: string }>;
  onOpen: (idx: number) => void;
}) {
  const [i, setI] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const lastManual = useRef(0);
  useEffect(() => {
    if (shots.length < 2) return;
    const t = setInterval(() => {
      const el = scroller.current;
      if (!el || document.hidden) return;
      if (Date.now() - lastManual.current < 6000) return; // 指で触った直後は自動送りを一時停止
      const w = el.clientWidth;
      if (!w) return;
      const next = (Math.round(el.scrollLeft / w) + 1) % shots.length;
      el.scrollTo({ left: next * w, behavior: "smooth" });
    }, 3500);
    return () => clearInterval(t);
  }, [shots.length]);
  if (shots.length === 0) return null;
  const cur = shots[Math.min(i, shots.length - 1)];
  return (
    <div className="relative -mx-2 mb-3 w-[calc(100%+16px)] overflow-hidden" style={{ height: 240, background: "#3a3428" }}>
      <div
        ref={scroller}
        className="hide-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto"
        style={{ touchAction: "pan-x pan-y" }}
        onScroll={(e) => {
          const el = e.currentTarget;
          const k = Math.round(el.scrollLeft / el.clientWidth);
          if (k !== i) setI(Math.min(shots.length - 1, Math.max(0, k)));
        }}
        onTouchStart={() => {
          lastManual.current = Date.now();
        }}
        onPointerDown={() => {
          lastManual.current = Date.now();
        }}
      >
        {shots.map((s, k) => (
          <button
            key={`${s.url}-${k}`}
            onClick={() => onOpen(k)}
            className="h-full w-full flex-shrink-0 snap-center"
            aria-label="現地の写真を拡大"
          >
            <img src={s.thumb || s.url} alt="" draggable={false} className="h-full w-full select-none object-cover" />
          </button>
        ))}
      </div>
      {/* 下部グラデ + キャプション（スクロールを邪魔しないよう pointer-events なし） */}
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-2 pt-8 text-left"
        style={{ background: "linear-gradient(transparent, rgba(0,0,0,.55))" }}
      >
        <span className="block text-[12px] font-bold text-white drop-shadow">
          🟠 {cur.date} {cur.name}
        </span>
      </span>
      <span className="pointer-events-none absolute bottom-2 right-3 flex gap-1">
        {shots.map((_, k) => (
          <span
            key={k}
            className="rounded-full"
            style={{ width: k === i ? 7 : 5, height: k === i ? 7 : 5, background: k === i ? "#fff" : "rgba(255,255,255,.5)", transition: "width .15s,height .15s" }}
          />
        ))}
      </span>
    </div>
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

/* 掲示板トップの現地レポート・紹介ポスター（タップで拡大） */
const POSTERS = [
  { src: "/posters/poster2.webp", label: "わらわ〜ボランティアとは" },
  { src: "/posters/poster1.webp", label: "今、熊本はどうなってるの!?" },
  { src: "/posters/poster3.webp", label: "みんなの「私にできること」" },
  { src: "/posters/poster4.webp", label: "現地での体験" },
];

/* ============ フィード ============ */

/** 「寄付しました」系の短い報告か（写真・リンクなしで、寄付/振込/心ばかり…等の言い回しを含む） */
const DONATION_RE = /(寄付|寄附|振込|振り込|送金|入金|支援金|募金|少額|心ばかり|微力|わずか|お役に立て)/;
function isDonationOnly(body: string): boolean {
  return DONATION_RE.test(body);
}

interface FeedItem {
  key: string;
  userId: string;
  name: string;
  avatar: string | null;
  memberNo: number | null;
  createdAt: string;
  body: string;
  images: string[]; // 本体
  thumbs: string[]; // サムネ
  embed: OGPEmbed | null;
  pinned?: boolean;
  isReport?: boolean;
}

/**
 * 取り組みフィード（OneSea CotoZuteページと同じ挙動・見た目）。
 * scope="board": みんなの掲示板（現地報告も混ざって表示・🟠ラベル付き）
 * scope="report": 現地報告専用タブ（投稿はオレンジ軍団+管理者のみ=canPost）
 */
export function ActivityFeed({
  userId,
  myAvatar = null,
  isAdmin = false,
  requireJoin,
  scope = "board",
  canPost = true,
}: {
  userId: string | null;
  myAvatar?: string | null;
  isAdmin?: boolean;
  requireJoin: () => void;
  scope?: "board" | "report";
  canPost?: boolean;
}) {
  const router = useRouter();
  const [boards, setBoards] = useState<BoardMessage[]>([]);
  const [pinned, setPinned] = useState<BoardMessage[]>([]);
  const [likeCounts, setLikeCounts] = useState<Map<string, number>>(new Map());
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [likers, setLikers] = useState<Record<string, Liker[]>>({});
  const [expandedBody, setExpandedBody] = useState<Set<string>>(new Set());
  const [commentCounts, setCommentCounts] = useState<Map<string, number>>(new Map());
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [imgIdx, setImgIdx] = useState<Map<string, number>>(new Map());
  const [lightbox, setLightbox] = useState<{ urls: string[]; idx: number } | null>(null);
  const [poster, setPoster] = useState<number | null>(null);
  const [posterIdx, setPosterIdx] = useState(0);
  const [report, setReport] = useState<{ key: string; excerpt: string } | null>(null);
  // 🧡寄付してよかった（現地報告の投稿だけ・feed_likes を item_key "cheer:<id>" で流用）
  const [cheerCounts, setCheerCounts] = useState<Map<string, number>>(new Map());
  const [myCheers, setMyCheers] = useState<Set<string>>(new Set());
  // チップをタップ → その種別だけ表示（もう一度タップ or すべて表示 で解除）
  const cursorRef = useRef<string | null>(null);

  const pullBoard = async () => {
    const fresh = await fetchBoardSince(scope, cursorRef.current ?? "1970-01-01");
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
    fetchBoard(scope).then((rows) => {
      if (!alive) return;
      setBoards(rows);
      if (rows.length) cursorRef.current = rows[rows.length - 1].created_at;
      if (userId && scope === "board") markGroupRead("board", userId);
    });
    fetchPinnedBoard(scope).then((rows) => alive && setPinned(rows));
    const timer = setInterval(async () => {
      if (document.hidden || !cursorRef.current) return;
      await pullBoard();
      if (userId && scope === "board") markGroupRead("board", userId);
    }, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // 掲示板 = つながりのための掲示板。助けたい/助けての投稿は混ぜない（それぞれのタブにだけ並ぶ）
  const toItem = (m: BoardMessage, isPinned: boolean): FeedItem => ({
    key: `board:${m.id}`,
    isReport: m.scope === "report",
    userId: m.user_id,
    name: m.profiles?.display_name ?? "参加者",
    avatar: m.profiles?.avatar_url ?? null,
    memberNo: m.profiles?.member_no ?? null,
    createdAt: m.created_at,
    body: m.body,
    images: m.image_urls?.length ? m.image_urls : m.image_url ? [m.image_url] : [],
    thumbs: m.thumb_urls?.length ? m.thumb_urls : m.image_url ? [m.image_url] : [],
    embed: (m.embed as OGPEmbed | null) ?? null,
    pinned: isPinned,
  });
  // 並び順アルゴリズム(2026-08-18): 📌固定 → 中身のある投稿(写真/リンク付き・寄付報告以外) → 「寄付しました」だけの投稿。各段の中は新しい順
  const pinnedIds = new Set(pinned.map((m) => m.id));
  const rank = (it: FeedItem) =>
    scope === "report" || it.images.length > 0 || it.embed ? 1 : isDonationOnly(it.body) ? 3 : 1;
  const items: FeedItem[] = [
    ...pinned.map((m) => toItem(m, true)),
    ...boards
      .filter((m) => !pinnedIds.has(m.id))
      .map((m) => toItem(m, false))
      .sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt)),
  ];
  const visible = items;
  // ヒーロー・スライドショー: 現地報告の写真を新しい順に最大10枚
  const heroShots =
    scope === "report"
      ? items
          .flatMap((it) =>
            it.images.map((url, k) => ({
              url,
              thumb: it.thumbs[k] ?? url,
              name: it.name,
              date: jstDay(it.createdAt),
            }))
          )
          .slice(0, 10)
      : [];

  const togglePin = async (it: FeedItem) => {
    const rawId = it.key.split(":")[1];
    const on = !it.pinned;
    if (!window.confirm(on ? "この投稿を掲示板のトップに固定しますか？" : "トップ固定を解除しますか？")) return;
    const { error } = await setBoardPinned(rawId, on);
    if (error) {
      window.alert("変更できませんでした");
      return;
    }
    fetchPinnedBoard(scope).then(setPinned);
  };

  useEffect(() => {
    const keys = items.map((i) => i.key).slice(0, 100);
    if (keys.length === 0) return;
    fetchFeedLikes(keys, userId).then(({ counts, mine }) => {
      setLikeCounts(counts);
      setMyLikes(mine);
    });
    fetchLikersFor(keys).then(setLikers);
    fetchCommentCounts(keys).then(setCommentCounts);
    const cheerKeys = items.filter((i) => i.isReport).map((i) => `cheer:${i.key.split(":")[1]}`);
    if (cheerKeys.length) {
      fetchFeedLikes(cheerKeys, userId).then(({ counts, mine }) => {
        setCheerCounts(counts);
        setMyCheers(mine);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boards.length, pinned.length, userId]);

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
    // いいねした人の顔をその記事だけ取り直す
    fetchLikersFor([key]).then((m) =>
      setLikers((prev) => ({ ...prev, [key]: m[key] ?? [] }))
    );
  };

  const cheer = async (it: FeedItem) => {
    if (!userId) {
      requireJoin();
      return;
    }
    const key = `cheer:${it.key.split(":")[1]}`;
    const on = !myCheers.has(key);
    setMyCheers((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
    setCheerCounts((prev) => {
      const next = new Map(prev);
      next.set(key, Math.max(0, (next.get(key) ?? 0) + (on ? 1 : -1)));
      return next;
    });
    await toggleFeedLike(key, userId, on);
  };

  // 「私の寄付で、この活動を支援できました！」をSNSへ（スマホは共有シート／PCはXポスト画面）
  const sharePost = async (it: FeedItem) => {
    const url = `${window.location.origin}/post/board/${it.key.split(":")[1]}`;
    const text = "私の寄付で、この活動を支援できました！\n熊本地震支援「わらわ〜ボランティア」現地報告\n";
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
      } catch {}
      return;
    }
    window.open(
      `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener"
    );
  };

  const needsFold = (b: string) => b.length > 60 || b.includes("\n");

  const removeItem = async (it: FeedItem) => {
    if (!window.confirm("この投稿を削除しますか？")) return;
    const rawId = it.key.split(":")[1];
    await deleteBoardMessage(rawId);
    setBoards((prev) => prev.filter((m) => m.id !== rawId));
    setPinned((prev) => prev.filter((m) => m.id !== rawId));
  };

  return (
    <div>
      {canPost ? (
        <PostComposer
          scope={scope}
          prompt={scope === "report" ? "現地の様子を報告する" : "書き込む"}
          userId={userId}
          myAvatar={myAvatar}
          requireJoin={requireJoin}
          onPosted={pullBoard}
        />
      ) : (
        <p className="mb-3 rounded-xl px-3 py-2 text-center text-[12px] font-bold text-[#8a7a5a]" style={{ background: "#fdeedd" }}>
          🟠 ここに投稿できるのは現地入りメンバーと事務局です。応援はいいね・コメントでどうぞ！
        </p>
      )}

      {/* 現地レポート・紹介ポスター: 1枚ずつ左右スワイプ（スナップ・次の1枚がチラ見え）・タップで拡大 */}
      {scope === "board" && (
      <div className="mb-3">
        <div
          className="hide-scrollbar -mx-2 flex snap-x snap-mandatory gap-2 overflow-x-auto px-2 pb-1"
          style={{ touchAction: "pan-x pan-y", scrollPaddingLeft: 8 }}
          onScroll={(e) => {
            const el = e.currentTarget;
            const w = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 8 : el.clientWidth;
            const i = Math.round(el.scrollLeft / w);
            if (i !== posterIdx) setPosterIdx(Math.min(POSTERS.length - 1, Math.max(0, i)));
          }}
        >
          {POSTERS.map((p, i) => (
            <button
              key={p.src}
              onClick={() => setPoster(i)}
              className="w-[70%] shrink-0 snap-start overflow-hidden rounded-xl border-2 bg-white text-left shadow-sm"
              style={{ borderColor: "#e8c890" }}
            >
              <img src={p.src} alt={p.label} className="aspect-[3/4] w-full object-cover object-top" />
              <span className="block truncate px-2 py-1.5 text-[12px] font-bold text-[#8a7a5a]">
                {i + 1}. {p.label}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-center gap-1.5">
          {POSTERS.map((_, i) => (
            <span key={i} className="rounded-full" style={{ width: i === posterIdx ? 8 : 6, height: i === posterIdx ? 8 : 6, background: i === posterIdx ? "#d96a1a" : "#d8d4c8" }} />
          ))}
        </div>
      </div>
      )}

      {/* 現地報告: ヒーロー・スライドショー（最新の報告写真・タップで拡大） */}
      {scope === "report" && (
        <ReportHero
          shots={heroShots}
          onOpen={(i) => setLightbox({ urls: heroShots.map((s) => s.url), idx: i })}
        />
      )}

      {/* 中央フィード（CotoZuteと同じ白い列・左右いっぱいの写真） */}
      <div>
        {visible.length === 0 && (
          <p className="py-12 text-center text-[13px] text-[#8a8d91]">
            {scope === "report"
              ? "現地からの報告をお待ちください"
              : "まだ取り組みがありません。最初のひとことをどうぞ"}
          </p>
        )}
        {visible.slice(0, 80).map((it, mi, arr) => {
          const bodyExpanded = expandedBody.has(it.key);
          const idx = imgIdx.get(it.key) ?? 0;
          // 日付別アルバム見出し（現地報告タブのみ・日が変わる位置に挟む）
          const dayHeader =
            scope === "report" && (mi === 0 || jstDay(arr[mi - 1].createdAt) !== jstDay(it.createdAt))
              ? jstDay(it.createdAt)
              : null;
          return (
            <div key={it.key}>
            {dayHeader && (
              <div className="-mx-2 flex items-center gap-2 px-3 pb-1.5 pt-4">
                <span className="rounded-full px-2.5 py-1 text-[12.5px] font-extrabold text-white" style={{ background: "#d96a1a" }}>
                  📅 {dayHeader}の活動
                </span>
                <span className="h-[2px] flex-1 rounded" style={{ background: "#f0d0a8" }} />
              </div>
            )}
            <div
              className="-mx-2 border-b border-[#f0ece0] bg-white"
            >
              <div className="relative overflow-hidden px-3 py-2.5">
                <div className="relative">
                {it.pinned && (
                  <div className="mb-1.5 flex items-center gap-1 text-[11.5px] font-bold text-[#8a8d91]">
                    <span>📌</span> トップに固定
                  </div>
                )}
                {scope === "board" && it.isReport && (
                  <div className="mb-1.5">
                    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white" style={{ background: "#d96a1a" }}>
                      🟠 現地報告
                    </span>
                  </div>
                )}
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
                      {it.userId === ORANGE_LEADER_ID && it.isReport && (
                        <span className="mr-1.5 rounded-full px-1.5 py-[1px] text-[10px] font-extrabold text-white" style={{ background: "linear-gradient(90deg,#e8862c,#d96a1a)" }}>
                          👑 オレンジ軍団リーダー
                        </span>
                      )}
                      {relTime(it.createdAt)}
                      {it.memberNo != null && (
                        <span className="num ml-1.5">@わらわ〜ボランティアNo.{it.memberNo}</span>
                      )}
                    </div>
                  </div>
                  {userId && (
                    <DotsMenu
                      canEdit={userId === it.userId || isAdmin}
                      onEdit={() => router.push(`/post/board/${it.key.split(":")[1]}?edit=1`)}
                      onDelete={() => removeItem(it)}
                      onReport={() => setReport({ key: it.key, excerpt: it.body })}
                      extra={isAdmin ? [{ label: it.pinned ? "📌 トップ固定を解除" : "📌 トップに固定", onClick: () => togglePin(it) }] : []}
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
                      <Linkify text={it.body} />
                    </p>
                    {needsFold(it.body) && !bodyExpanded && (
                      <button
                        onClick={() => setExpandedBody((p) => new Set(p).add(it.key))}
                        className="text-[13.5px] text-[#8a8d91]"
                      >
                        …もっと見る
                      </button>
                    )}
                    {needsFold(it.body) && bodyExpanded && (
                      <button
                        onClick={() =>
                          setExpandedBody((p) => {
                            const n = new Set(p);
                            n.delete(it.key);
                            return n;
                          })
                        }
                        className="mt-1 text-[13.5px] text-[#8a8d91]"
                      >
                        △ 折りたたむ
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
                {it.images.length > 0 && (
                  <PhotoCarousel
                    className="-mx-3 mt-2"
                    images={it.images}
                    thumbs={it.thumbs}
                    onOpen={(i) => setLightbox({ urls: it.images, idx: i })}
                  />
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


                {/* 現地報告だけ: 🧡寄付してよかった + 📣シェア */}
                {it.isReport && (() => {
                  const ckey = `cheer:${it.key.split(":")[1]}`;
                  const on = myCheers.has(ckey);
                  const n = cheerCounts.get(ckey) ?? 0;
                  return (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => cheer(it)}
                        className="flex items-center gap-1 rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold transition-colors"
                        style={
                          on
                            ? { background: "#d96a1a", borderColor: "#d96a1a", color: "#fff" }
                            : { background: "#fff", borderColor: "#f0d0a8", color: "#c05e14" }
                        }
                      >
                        🧡 寄付してよかった{n > 0 && <span className="num ml-0.5">{n}</span>}
                      </button>
                      <button
                        onClick={() => sharePost(it)}
                        className="flex items-center gap-1 rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold"
                        style={{ background: "#fff", borderColor: "#f0d0a8", color: "#c05e14" }}
                      >
                        📣 シェア
                      </button>
                    </div>
                  );
                })()}

                {/* いいねした人の顔（CotoZuteのFB風・ハートの下） */}
                {(likers[it.key]?.length ?? 0) > 0 && (
                  <div className="mt-1 flex items-center">
                    {likers[it.key].map((l, i) => (
                      <span key={i} style={{ marginLeft: i === 0 ? 0 : -6 }}>
                        {l.avatar_url ? (
                          <img src={l.avatar_url} alt="" referrerPolicy="no-referrer" className="h-[20px] w-[20px] rounded-full border-2 border-white object-cover" />
                        ) : (
                          <span className="flex h-[20px] w-[20px] items-center justify-center rounded-full border-2 border-white bg-[#fdeedd]">
                            <img src="/icons/icon-leaf.webp" alt="" style={{ width: 12, height: 12 }} />
                          </span>
                        )}
                      </span>
                    ))}
                    <span className="ml-1.5 text-[11px] text-[#8a8d91]">
                      {likers[it.key][0]?.display_name ?? ""}
                      {(likeCounts.get(it.key) ?? 0) > 1 ? ` 他${(likeCounts.get(it.key) ?? 0) - 1}人` : ""}
                    </span>
                  </div>
                )}
                {openComments.has(it.key) && (
                  <CommentSection
                    itemKey={it.key}
                    userId={userId}
                    isAdmin={isAdmin}
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
                  className="pointer-events-none absolute h-[84px] w-[84px] object-contain"
                  style={{
                    opacity: 0.12,
                    bottom: -13,
                    right: -14,
                    transform: "rotate(-8deg)",
                  }}
                />
              </div>
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

      {/* ポスター拡大: 文字が読めるよう画面幅いっぱい+縦スクロール */}
      {poster !== null && (
        <Lightbox urls={POSTERS.map((p) => p.src)} index={poster} onClose={() => setPoster(null)} />
      )}
      {lightbox && <Lightbox urls={lightbox.urls} index={lightbox.idx} onClose={() => setLightbox(null)} />}
    </div>
  );
}

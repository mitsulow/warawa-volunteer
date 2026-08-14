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
  type BoardMessage,
  type Offer,
} from "@/lib/db";
import { uploadImagePair, type ImagePair } from "@/lib/images";
import { deleteBoardMessage, deleteOffer } from "@/lib/db";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { EmbedCard, type OGPEmbed } from "@/components/EmbedCard";
import { SnsIcon } from "@/components/SnsIcon";
import { DotsMenu } from "@/components/PostKit";
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

/** 投稿の区切り線（CotoZute文法・色はオレンジ・左右いっぱい） */
function Band() {
  return <div className="-mx-4 h-px" style={{ background: "#d96a1a", opacity: 0.22 }} />;
}

const URL_REGEX = /https?:\/\/[^\s]+/g;
const PLATFORMS: Array<[string, string]> = [
  ["instagram", "Instagram"], ["x", "X"], ["youtube", "YouTube"],
  ["tiktok", "TikTok"], ["note", "note"], ["ameblo", "アメブロ"], ["facebook", "Facebook"],
];

function detectPlatform(url: string): string | undefined {
  if (/instagram\.com/.test(url)) return "instagram";
  if (/x\.com|twitter\.com/.test(url)) return "x";
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  if (/tiktok\.com/.test(url)) return "tiktok";
  if (/facebook\.com/.test(url)) return "facebook";
  if (/note\.com/.test(url)) return "note";
  if (/ameblo\.jp/.test(url)) return "ameblo";
  return undefined;
}

async function fetchOGP(url: string): Promise<OGPEmbed | null> {
  try {
    const res = await fetch(`/api/ogp?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.title && !data.description && !data.image) {
      return { url, title: new URL(url).hostname, platform: detectPlatform(url) };
    }
    return {
      url,
      title: data.title || new URL(url).hostname,
      description: data.description,
      image: data.image,
      platform: detectPlatform(url),
    };
  } catch {
    return null;
  }
}

/* ============ 投稿欄（CotozuteComposerと同じ挙動） ============ */

function TorikumiComposer({
  userId,
  myAvatar,
  requireJoin,
  onPosted,
}: {
  userId: string | null;
  myAvatar: string | null;
  requireJoin: () => void;
  onPosted: () => void;
}) {
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [embed, setEmbed] = useState<OGPEmbed | null>(null);
  const [loadingOGP, setLoadingOGP] = useState(false);
  const [images, setImages] = useState<ImagePair[]>([]);
  const [uploading, setUploading] = useState(false);
  const lastFetchedUrl = useRef<string | null>(null);

  /* 下書き: アプリ切替・スリープでも本文が消えない（CotoZuteと同じ） */
  useEffect(() => {
    try {
      const d = localStorage.getItem("warawa-draft");
      if (d) setBody(d);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      if (body) localStorage.setItem("warawa-draft", body);
      else localStorage.removeItem("warawa-draft");
    } catch {}
  }, [body]);

  // URLを検出したらOGPを自動取得（本文・URL欄のどちらでも）
  useEffect(() => {
    const urlFromInput = linkUrl.trim().match(URL_REGEX)?.[0];
    const urlFromBody = body.match(URL_REGEX)?.[0];
    const firstUrl = urlFromInput || urlFromBody || null;
    if (!firstUrl) {
      setEmbed(null);
      lastFetchedUrl.current = null;
      return;
    }
    if (firstUrl === lastFetchedUrl.current) return;
    lastFetchedUrl.current = firstUrl;
    const timer = setTimeout(async () => {
      setLoadingOGP(true);
      setEmbed(await fetchOGP(firstUrl));
      setLoadingOGP(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [body, linkUrl]);

  const removeEmbed = () => {
    setEmbed(null);
    setLinkUrl("");
    lastFetchedUrl.current = "__removed__";
  };

  const submit = async () => {
    if (!userId || (!body.trim() && !embed && images.length === 0) || sending) return;
    setSending(true);
    setMessage(null);
    const { error } = await sendBoardMessage("board", userId, body.trim(), null, {
      imageUrls: images.map((i) => i.full),
      thumbUrls: images.map((i) => i.thumb),
      embed: embed ?? null,
    });
    setSending(false);
    if (error) {
      setMessage(`投稿できませんでした: ${error.message}`);
      return;
    }
    setBody("");
    setLinkUrl("");
    setEmbed(null);
    setImages([]);
    lastFetchedUrl.current = null;
    setExpanded(false);
    setMessage("投稿しました");
    onPosted();
  };

  // 投稿ボックス（CotoZuteと同じFB型: アバター + 丸ボックス「書き込む|」）
  if (!expanded) {
    return (
      <div className="flex items-center gap-2.5 py-2.5">
        {myAvatar ? (
          <img
            src={myAvatar}
            alt=""
            referrerPolicy="no-referrer"
            className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#f0f2f5]">
            <img src="/icons/icon-leaf.webp" alt="" style={{ width: 18, height: 18 }} />
          </span>
        )}
        <button
          onClick={() => (userId ? setExpanded(true) : requireJoin())}
          className="flex-1 rounded-full border border-[#dcdfe4] bg-white px-4 py-2 text-left text-[14.5px] text-[#65676b]"
        >
          書き込む<span className="caret-blink" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="いまの取り組みを、ひとこと。"
        maxLength={500}
        rows={3}
        autoFocus
        className="w-full resize-y rounded-xl border border-[#e8dcc4] bg-white p-3 text-[14px] leading-relaxed outline-none focus:border-[#d96a1a]"
      />

      {/* 写真（サムネ+本体の2枚方式・最大4枚） */}
      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2">
        {images.map((img, i) => (
          <div key={img.thumb} className="relative">
            <img src={img.thumb} alt="" className="h-16 w-16 rounded-lg object-cover" />
            <button
              onClick={() => setImages(images.filter((_, j) => j !== i))}
              aria-label="画像を外す"
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] text-white"
            >
              ✕
            </button>
          </div>
        ))}
        {images.length < 4 && (
          <label className="flex h-16 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e8dcc4] bg-white px-4 text-[12.5px] font-bold text-[#8a7a5a]">
            {uploading ? (
              "⏳ 圧縮中..."
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 7h3l1.5-2.2A1 1 0 0 1 9.3 4.4h5.4a1 1 0 0 1 .8.4L17 7h3a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V8.5A1.5 1.5 0 0 1 4 7Z" />
                  <circle cx="12" cy="13" r="3.6" />
                </svg>
                写真
              </>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={async (e) => {
                if (!userId || !e.target.files?.length || uploading) return;
                setUploading(true);
                const files = Array.from(e.target.files).slice(0, 4 - images.length);
                const pairs: ImagePair[] = [];
                for (const f of files) {
                  const pair = await uploadImagePair(userId, f);
                  if (pair) pairs.push(pair);
                }
                if (pairs.length) setImages((prev) => [...prev, ...pairs].slice(0, 4));
                setUploading(false);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>

      {/* OGPプレビュー */}
      {loadingOGP && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#b0a898]">
          <span className="animate-pulse">⏳</span> リンクを取り込んでいます...
        </div>
      )}
      {embed && !loadingOGP && (
        <div className="relative mt-1">
          <div className="px-1 py-0.5 text-[10px] font-medium text-[#4a8a5c]">✓ 取り込みました</div>
          <EmbedCard embed={embed} />
          <button
            type="button"
            onClick={removeEmbed}
            aria-label="埋め込みを外す"
            className="absolute right-1 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* SNSリンク貼り付け */}
      <div className="mt-2.5 rounded-xl border-2 border-dashed p-3" style={{ borderColor: "#d96a1a4d", background: "#d96a1a0d" }}>
        <div className="mb-1.5 flex items-center gap-1.5">
          <img src="/icons/icon-link.webp" alt="" style={{ width: 17, height: 17 }} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
          <span className="text-xs font-medium text-[#5a5448]">SNS取り込めます</span>
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {PLATFORMS.map(([id, label]) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full border border-[#ede5d8] bg-white px-2 py-0.5 text-[10.5px] text-[#b0a898]">
              <SnsIcon platform={id} size={12} />
              {label}
            </span>
          ))}
        </div>
        <input
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="URLをここに貼り付け（https://...）"
          className="w-full rounded-lg border border-[#ede5d8] bg-white px-3 py-2 text-xs outline-none focus:border-[#d96a1a]"
        />
      </div>

      {/* 送信バー */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-[#c0b8a8]">{message ?? `${body.length}/500`}</span>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setExpanded(false);
              setBody("");
              removeEmbed();
            }}
            className="rounded-xl px-3 py-2 text-[12.5px] font-bold text-[#a09888]"
          >
            キャンセル
          </button>
          <button
            onClick={submit}
            disabled={(!body.trim() && !embed && images.length === 0) || sending || uploading}
            className="rounded-xl px-5 py-2 text-[13px] font-extrabold text-white disabled:opacity-40"
            style={{ background: "#d96a1a" }}
          >
            {sending ? "投稿中..." : "投稿"}
          </button>
        </div>
      </div>
    </div>
  );
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
    ...offers.map((o) => ({
      key: `offer:${o.id}`,
      userId: o.user_id,
      name: o.profiles?.display_name ?? "参加者",
      avatar: o.profiles?.avatar_url ?? null,
      memberNo: o.profiles?.member_no ?? null,
      createdAt: o.created_at,
      chip:
        o.kind === "money"
          ? "お金を出します"
          : o.kind === "goods"
            ? "物資を出します"
            : o.kind === "other"
              ? "できる事を出します"
              : o.status === "confirmed"
                ? "🟠 現地入りメンバー"
                : "現地入り申請中",
      body: o.kind === "goods" && o.title ? `${o.title}\n${o.detail}` : o.detail,
      images: o.image_url ? [o.image_url] : [],
      thumbs: o.image_url ? [o.image_url] : [],
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
      <TorikumiComposer
        userId={userId}
        myAvatar={myAvatar}
        requireJoin={requireJoin}
        onPosted={pullBoard}
      />

      {/* 中央フィード（CotoZuteと同じ白い列・左右いっぱいの写真） */}
      <div className="-mx-4 bg-white px-4">
        {items.length === 0 && (
          <p className="py-12 text-center text-[13px] text-[#8a8d91]">
            まだ取り組みがありません。最初のひとことをどうぞ
          </p>
        )}
        {items.slice(0, 80).map((it) => {
          const bodyExpanded = expandedBody.has(it.key);
          const idx = imgIdx.get(it.key) ?? 0;
          return (
            <div key={it.key}>
              <div className="py-2.5">
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
                      className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#1c1e21] ${
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
                  <div className="-mx-4 mt-2">
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
                  <div className="-mx-4 mt-2">
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
                    className="flex items-center"
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
              <Band />
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

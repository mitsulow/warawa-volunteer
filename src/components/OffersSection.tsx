"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addOffer,
  deleteOffer,
  fetchCommentCounts,
  fetchFeedLikes,
  fetchLikersFor,
  fetchOffers,
  toggleFeedLike,
  type Liker,
  type Offer,
  type OfferKind,
} from "@/lib/db";
import { CommentSection } from "@/components/CommentSection";
import { DotsMenu } from "@/components/PostKit";
import { ReportDialog } from "@/components/ReportDialog";
import { uploadImagePair, type ImagePair } from "@/lib/images";
import { firePush } from "@/lib/push";
import { Avatar } from "@/components/Avatar";
import { BodyApplyDialog } from "@/components/BodyApplyDialog";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { EmbedCard, type OGPEmbed } from "@/components/EmbedCard";
import { SnsIcon } from "@/components/SnsIcon";
import type { Profile } from "@/lib/db";
import { useRef } from "react";

const URL_REGEX = /https?:\/\/[^\s]+/g;
const SNS_PLATFORMS: Array<[string, string]> = [
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

/* eslint-disable @next/next/no-img-element */

/* CotoZuteと同じアイコン文法（ActivityFeedと同一） */
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

const KINDS: Record<
  OfferKind,
  { icon: string; label: string; verb: string }
> = {
  money: { icon: "/icons/icon-yen.webp", label: "寄付をする", verb: "お金を出します" },
  body: { icon: "/icons/icon-tasukete.webp", label: "現地へ行く", verb: "体を出します" },
  goods: { icon: "/icons/icon-rice.webp", label: "物資を送る", verb: "物資を出します" },
  other: { icon: "/icons/icon-gift.webp", label: "その他", verb: "持ち寄ります" },
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 💰 振込のご案内（表示のみ・フィードには並ばない） */
function BankDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <img src="/icons/icon-yen.webp" alt="" className="h-7 w-7 object-contain" />
          寄付をする
        </h3>
        <p className="mt-2 text-sm text-[#5a5448]">以下への振り込みをお願い致します。</p>
        <div
          className="mt-3 space-y-1.5 rounded-xl border p-4 text-[14.5px] leading-relaxed"
          style={{ borderColor: "#e8c890", background: "#fffaf0" }}
        >
          <p><span className="mr-1 text-[11px] font-bold text-[#a09888]">銀行名</span> GMOあおぞらネット銀行</p>
          <p><span className="mr-1 text-[11px] font-bold text-[#a09888]">支店名</span> 法人第二営業部</p>
          <p><span className="mr-1 text-[11px] font-bold text-[#a09888]">口座　</span> 普通 1007941</p>
          <p><span className="mr-1 text-[11px] font-bold text-[#a09888]">名義　</span> ファミュニティリンク カ）</p>
        </div>
        <p className="mt-2 text-[14px] font-bold leading-relaxed text-[#5a5448]">
          ※なお、小銭の両替手数料の関係から、1口（1,000円）以上からの寄付をお願いしております。ご協力お願い致します。
        </p>
        <button
          className="mt-2 w-full rounded-xl border py-2 text-[12.5px] font-bold"
          style={{ borderColor: "#d96a1a", color: "#d96a1a" }}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                "GMOあおぞらネット銀行 法人第二営業部 普通 1007941 ファミュニティリンク カ）"
              );
              alert("口座情報をコピーしました");
            } catch {}
          }}
        >
          📋 口座情報をコピーする
        </button>
        <button
          className="mt-4 w-full rounded-xl py-3 font-bold text-white"
          style={{ background: "#d96a1a" }}
          onClick={onClose}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

/** 🍚物資 / 🎁その他 の投稿フォーム（CotoZute型: テキスト+写真4枚） */
function OfferDialog({
  kind,
  userId,
  onClose,
  onDone,
}: {
  kind: "goods" | "other";
  userId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [detail, setDetail] = useState("");
  const [images, setImages] = useState<ImagePair[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [embed, setEmbed] = useState<OGPEmbed | null>(null);
  const [loadingOGP, setLoadingOGP] = useState(false);
  const lastFetchedUrl = useRef<string | null>(null);

  const isGoods = kind === "goods";
  const draftKey = `warawa-draft-offer-${kind}`;

  // URLを貼ると自動でOGP取り込み（CotoZuteと同じ）
  useEffect(() => {
    const urlFromInput = linkUrl.trim().match(URL_REGEX)?.[0];
    const urlFromBody = detail.match(URL_REGEX)?.[0];
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
  }, [detail, linkUrl]);

  const removeEmbed = () => {
    setEmbed(null);
    setLinkUrl("");
    lastFetchedUrl.current = "__removed__";
  };

  /* 下書き保存（CotoZuteと同じ: アプリ切替でも本文が消えない） */
  useEffect(() => {
    try {
      const d = localStorage.getItem(draftKey);
      if (d) setDetail(d);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (detail) localStorage.setItem(draftKey, detail);
      else localStorage.removeItem(draftKey);
    } catch {}
  }, [detail, draftKey]);

  const submit = async () => {
    if (!detail.trim()) {
      setError("内容を書いてください");
      return;
    }
    setBusy(true);
    setError("");
    const { error: e } = await addOffer(userId, kind, detail.trim(), null, null, {
      imageUrls: images.map((i) => i.full),
      thumbUrls: images.map((i) => i.thumb),
      embed: embed ?? null,
    });
    setBusy(false);
    if (e) {
      setError(`投稿できませんでした: ${e.message}`);
      return;
    }
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    setSent(true);
    onDone();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="text-center">
            <div className="text-3xl">{isGoods ? "🍀" : "🎁"}</div>
            <h3 className="mt-2 text-lg font-bold">投稿しました</h3>
            <p className="mt-2 text-sm text-[#8a8070]">
              現地の人が欲しいモノと一致したら、送付をお願いする事があります。
            </p>
            <button
              className="mt-4 w-full rounded-xl py-3 font-bold text-white"
              style={{ background: "#d96a1a" }}
              onClick={onClose}
            >
              閉じる
            </button>
          </div>
        ) : (
          <>
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <img src={KINDS[kind].icon} alt="" className="h-7 w-7 object-contain" />
              {KINDS[kind].label}
            </h3>
            {isGoods && (
              <div className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-[#5a5448]">
                <p>① 何を送れるか、写真イメージなどと一緒に投稿</p>
                <p>② 現地の人とニーズを確認し、「必要」と判断された物資の投稿者へ事務局から連絡（アプリ内のTalk機能）</p>
                <p>③ 記載された住所（炊き出し場所など）へ、送料はお客様負担にてお送り下さい</p>
                <p className="font-bold" style={{ color: "#c05e14" }}>
                  ※発送は必ず「必要」の連絡が来た後にお願い致します。
                </p>
              </div>
            )}
            <label className="mt-3 block text-sm font-bold">
              {isGoods ? "私はこういう物を出せます" : "私が持ち寄れるもの・アイディア・その他"}
            </label>
            <textarea
              className="mt-1 w-full resize-y rounded-xl border border-[#e8dcc4] bg-white p-3 text-[14px] leading-relaxed outline-none focus:border-[#d96a1a]"
              rows={3}
              maxLength={500}
              autoFocus
              placeholder={
                isGoods
                  ? "ナチュラルなお味噌、自然栽培の野菜"
                  : "例: 炊き出しのレシピ提供できます / 現地までの輸送アイディアがあります"
              }
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />

            {/* 写真（CotoZuteと同じサムネ+本体2枚方式・最大4枚） */}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
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
                      if (!e.target.files?.length || uploading) return;
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

            {/* SNSリンク貼り付け（CotoZuteと同じ） */}
            <div className="mt-2.5 rounded-xl border-2 border-dashed p-3" style={{ borderColor: "#d96a1a4d", background: "#d96a1a0d" }}>
              <div className="mb-1.5 flex items-center gap-1.5">
                <img src="/icons/icon-link.webp" alt="" style={{ width: 17, height: 17 }} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                <span className="text-xs font-medium text-[#5a5448]">SNS取り込めます</span>
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {SNS_PLATFORMS.map(([id, label]) => (
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

            {/* 送信バー（CotoZuteと同じ: 文字数カウンター + キャンセル/投稿） */}
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-[#c0b8a8]">
                {error ? <span className="font-bold text-red-600">{error}</span> : `${detail.length}/500`}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="rounded-xl px-3 py-2 text-[12.5px] font-bold text-[#a09888]"
                >
                  キャンセル
                </button>
                <button
                  onClick={submit}
                  disabled={busy || uploading || !detail.trim()}
                  className="rounded-xl px-5 py-2 text-[13px] font-extrabold text-white disabled:opacity-40"
                  style={{ background: "#d96a1a" }}
                >
                  {busy ? "投稿中..." : "投稿"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 助けたい（私にできる事）:
 * 4ボタン: お金=振込案内表示 / 体=事務局への申請のみ / 物資・その他=投稿してフィードに並ぶ
 */
export function OffersSection({
  userId,
  profile,
  isAdmin,
  requireJoin,
  openGoodsSignal = 0,
}: {
  userId: string | null;
  profile: Profile | null;
  isAdmin: boolean;
  requireJoin: () => void;
  openGoodsSignal?: number;
}) {
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [dialog, setDialog] = useState<OfferKind | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // CotoZuteと同じ記事挙動（いいね/コメント/…メニュー/折りたたみ/写真拡大）
  const [likeCounts, setLikeCounts] = useState<Map<string, number>>(new Map());
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [likers, setLikers] = useState<Record<string, Liker[]>>({});
  const [commentCounts, setCommentCounts] = useState<Map<string, number>>(new Map());
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [expandedBody, setExpandedBody] = useState<Set<string>>(new Set());
  const [imgIdx, setImgIdx] = useState<Map<string, number>>(new Map());
  const [lightbox, setLightbox] = useState<{ urls: string[]; idx: number } | null>(null);
  const [report, setReport] = useState<{ key: string; excerpt: string } | null>(null);

  const reload = () => fetchOffers().then(setOffers);
  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    const keys = offers
      .filter((o) => o.kind === "goods" || o.kind === "other")
      .map((o) => `offer:${o.id}`)
      .slice(0, 100);
    if (keys.length === 0) return;
    fetchFeedLikes(keys, userId).then(({ counts, mine }) => {
      setLikeCounts(counts);
      setMyLikes(mine);
    });
    fetchLikersFor(keys).then(setLikers);
    fetchCommentCounts(keys).then(setCommentCounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers.length, userId]);

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

  const needsFold = (b: string) => b.length > 60 || b.includes("\n");

  const removeOffer = async (id: string) => {
    if (!window.confirm("この投稿を削除しますか？")) return;
    await deleteOffer(id);
    setOffers((prev) => prev.filter((o) => o.id !== id));
  };

  // トップの「物資を登録する」CTAから物資フォームを直接開く
  useEffect(() => {
    if (openGoodsSignal > 0) open("goods");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openGoodsSignal]);

  const open = (kind: OfferKind) => {
    if (kind !== "money" && !userId) {
      requireJoin();
      return;
    }
    if (kind === "money" && userId) {
      // 事務局アカウントから寄付案内のTalKを自動送信（重複はサーバー側で防止）
      firePush("/api/donate-talk", {});
    }
    setDialog(kind);
  };

  // フィードに並ぶのは物資とその他だけ（体=事務局申請のみ・お金=案内のみ）
  const feed = offers.filter((o) => o.kind === "goods" || o.kind === "other");

  return (
    <div>
      {/* 折り畳みと4ボタンを1つの箱に一体化 */}
      <div className="mb-3 overflow-hidden rounded-xl border border-[#ede5d8] bg-white shadow-sm">
        <button
          className="flex w-full items-center justify-between px-3.5 py-1.5"
          style={{ background: "#fdeedd" }}
          onClick={() => setPickerOpen(!pickerOpen)}
        >
          <span className="text-[13.5px] font-bold text-[#5a5448]">何ができるかを選ぶ</span>
          <span className="text-[#b0a898]">{pickerOpen ? "△" : "▽"}</span>
        </button>
        {pickerOpen && (
          <div className="grid grid-cols-4 gap-2 border-t border-[#f0e9dc] bg-[#fffaf0] p-2">
            {(Object.keys(KINDS) as OfferKind[]).map((k) => (
              <button
                key={k}
                className="rounded-xl border border-[#ede5d8] bg-white py-1.5 shadow-sm transition-transform active:scale-95"
                onClick={() => open(k)}
              >
                <img src={KINDS[k].icon} alt="" className="mx-auto h-7 w-7 object-contain" />
                <div className="mt-1 text-[12px] font-bold text-[#3a3428]">{KINDS[k].label}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {dialog === "money" && <BankDialog onClose={() => setDialog(null)} />}
      {dialog === "body" && userId && profile && (
        <BodyApplyDialog
          userId={userId}
          profile={profile}
          onClose={() => setDialog(null)}
          onDone={reload}
        />
      )}
      {(dialog === "goods" || dialog === "other") && userId && (
        <OfferDialog
          kind={dialog}
          userId={userId}
          onClose={() => setDialog(null)}
          onDone={reload}
        />
      )}

      <div>
        {feed.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#e0d6c6] bg-white py-8 text-center text-sm text-[#a09888]">
            まだ投稿がありません
          </p>
        )}
        {feed.map((o) => {
          const key = `offer:${o.id}`;
          const name = o.profiles?.display_name ?? "参加者";
          const memberNo = o.profiles?.member_no ?? null;
          const body = o.title ? `${o.title}\n${o.detail}` : o.detail;
          const images = o.image_urls?.length ? o.image_urls : o.image_url ? [o.image_url] : [];
          const thumbs = o.thumb_urls?.length ? o.thumb_urls : o.image_url ? [o.image_url] : [];
          const embed = (o.embed as OGPEmbed | null) ?? null;
          const bodyExpanded = expandedBody.has(key);
          const idx = imgIdx.get(key) ?? 0;
          return (
            <div
              key={o.id}
              className="-mx-2 overflow-hidden"
              style={{ background: "#f9dfc2", padding: "5px 5px 0" }}
            >
              <div className="relative overflow-hidden rounded-b-xl bg-white px-3 py-2.5">
                <div className="relative">
                {/* ヘッダー（ActivityFeedと同一） */}
                <div className="flex items-center gap-2.5">
                  <Link href={`/u/${o.user_id}`} className="flex-shrink-0">
                    <Avatar name={name} url={o.profiles?.avatar_url} size={40} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/u/${o.user_id}`}
                      className="flex max-w-full items-center gap-1 truncate text-left text-[14.5px] font-bold leading-tight text-[#1c1e21] no-underline"
                    >
                      {name}
                      <VerifiedBadge size={14} />
                    </Link>
                    <div className="text-[11.5px] leading-tight text-[#8a8d91]">
                      {relTime(o.created_at)}
                      {memberNo != null && (
                        <span className="num ml-1.5">@ボランティアNo.{memberNo}</span>
                      )}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: "#fdf0e0", color: "#c05e14", border: "1px solid #f0d0a8" }}
                  >
                    {o.kind === "goods" ? "物資を出します" : "持ち寄ります"}
                  </span>
                  {userId && (
                    <DotsMenu
                      canEdit={userId === o.user_id || isAdmin}
                      onEdit={() => router.push(`/post/offer/${o.id}?edit=1`)}
                      onDelete={() => removeOffer(o.id)}
                      onReport={() => setReport({ key, excerpt: body })}
                    />
                  )}
                </div>

                {/* 本文（1行 → もっと見る → 折りたたむ・CotoZuteと同じ） */}
                {body.trim() && (
                  <div className="mt-2">
                    <p
                      className={`whitespace-pre-wrap break-words text-[16px] leading-relaxed text-[#1c1e21] ${
                        bodyExpanded || !needsFold(body) ? "" : "line-clamp-1"
                      }`}
                      onClick={() => {
                        if (needsFold(body) && !bodyExpanded)
                          setExpandedBody((p) => new Set(p).add(key));
                      }}
                    >
                      {body}
                    </p>
                    {needsFold(body) && !bodyExpanded && (
                      <button
                        onClick={() => setExpandedBody((p) => new Set(p).add(key))}
                        className="text-[13.5px] text-[#8a8d91]"
                      >
                        …もっと見る
                      </button>
                    )}
                  </div>
                )}

                {/* 埋め込み（SNSリンク） */}
                {embed && (
                  <div className="mt-2">
                    <EmbedCard embed={embed} />
                  </div>
                )}

                {/* 写真（左右いっぱい）。複数枚はインスタ式: 横スワイプ+●ドット */}
                {images.length === 1 && (
                  <div className="-mx-3 mt-2">
                    <button
                      onClick={() => setLightbox({ urls: images, idx: 0 })}
                      className="block w-full"
                      aria-label="写真をフル画質で見る"
                    >
                      <img src={thumbs[0] ?? images[0]} alt="" className="w-full object-cover" />
                    </button>
                  </div>
                )}
                {images.length > 1 && (
                  <div className="-mx-3 mt-2">
                    <div
                      className="hide-scrollbar flex snap-x snap-mandatory overflow-x-auto"
                      onScroll={(e) => {
                        const el = e.currentTarget;
                        const i = Math.round(el.scrollLeft / el.clientWidth);
                        if (i !== idx) setImgIdx((p) => new Map(p).set(key, i));
                      }}
                    >
                      {images.map((full, i) => (
                        <button
                          key={full}
                          onClick={() => setLightbox({ urls: images, idx: i })}
                          className="w-full flex-shrink-0 snap-center"
                          aria-label={`写真${i + 1}`}
                        >
                          <img
                            src={thumbs[i] ?? full}
                            alt=""
                            className="h-full w-full object-cover"
                            style={{ aspectRatio: "1" }}
                          />
                        </button>
                      ))}
                    </div>
                    <div className="mt-1.5 flex justify-center gap-1">
                      {images.map((_, i) => (
                        <span
                          key={i}
                          className="rounded-full"
                          style={{ width: 6, height: 6, background: i === idx ? "#d96a1a" : "#d8d4c8" }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* アイコン行（左寄せ・CotoZuteと同じ） */}
                <div className="mt-2 flex items-center gap-4">
                  <button className="flex items-center gap-1" onClick={() => like(key)} aria-label="いいね">
                    <IcoHeart on={myLikes.has(key)} />
                    {(likeCounts.get(key) ?? 0) > 0 && (
                      <span className="num text-[12.5px] font-bold text-[#8a8070]">
                        {likeCounts.get(key)}
                      </span>
                    )}
                  </button>
                  <button
                    className="flex items-center gap-1"
                    onClick={() =>
                      setOpenComments((prev) => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      })
                    }
                    aria-label="コメント"
                  >
                    <IcoBubble />
                    {(commentCounts.get(key) ?? 0) > 0 && (
                      <span className="num text-[12.5px] font-bold text-[#8a8070]">
                        {commentCounts.get(key)}
                      </span>
                    )}
                  </button>
                </div>

                {openComments.has(key) && (
                  <CommentSection
                    itemKey={key}
                    userId={userId}
                    requireJoin={requireJoin}
                    onAdded={() =>
                      setCommentCounts((prev) => {
                        const next = new Map(prev);
                        next.set(key, (next.get(key) ?? 0) + 1);
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
                  className="pointer-events-none absolute -right-6 h-28 w-28 object-contain"
                  style={{
                    opacity: 0.12,
                    bottom: -18,
                    transform: "rotate(-8deg)",
                  }}
                />
              </div>
              <div className="flex h-[24px] items-center justify-between px-2.5" style={{ background: "linear-gradient(90deg,#f4c894,#eeb578)" }}>
                {/* いいねした人の顔はロゴ帯の中(わらわ〜の横)に */}
                <div className="flex items-center">
                  {(likers[key] ?? []).map((l, i) => (
                    <span key={i} style={{ marginLeft: i === 0 ? 0 : -5 }}>
                      {l.avatar_url ? (
                        <img src={l.avatar_url} alt="" referrerPolicy="no-referrer" className="h-[17px] w-[17px] rounded-full border border-white object-cover" />
                      ) : (
                        <span className="flex h-[17px] w-[17px] items-center justify-center rounded-full border border-white bg-[#fdeedd]">
                          <img src="/icons/icon-leaf.webp" alt="" style={{ width: 10, height: 10 }} />
                        </span>
                      )}
                    </span>
                  ))}
                  {(likeCounts.get(key) ?? 0) > 3 && (
                    <span className="ml-1 text-[10px] font-bold text-[#a05c1a]">
                      +{(likeCounts.get(key) ?? 0) - 3}
                    </span>
                  )}
                </div>
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

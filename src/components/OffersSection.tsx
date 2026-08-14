"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  addOffer,
  fetchOffers,
  type Offer,
  type OfferKind,
} from "@/lib/db";
import { uploadImagePair, type ImagePair } from "@/lib/images";
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
              <p className="mt-2 text-[12px] leading-relaxed text-[#5a5448]">
                現地の人と相談し、「現地のNeeds」に見合った場合、メールか、アプリ内のTalk機能にてメッセージを送ります。
                そこに送付先の住所（炊き出しの場所や、現地の受け入れ拠点）を記載しますので、
                送料はお客さまで負担の上でお送りください。
                <br />
                <span className="font-bold">※採用の連絡が来た後に送付をお願い致します。</span>
              </p>
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
  void isAdmin;
  const [offers, setOffers] = useState<Offer[]>([]);
  const [dialog, setDialog] = useState<OfferKind | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const reload = () => fetchOffers().then(setOffers);
  useEffect(() => {
    reload();
  }, []);

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

      <div className="space-y-2">
        {feed.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#e0d6c6] bg-white py-8 text-center text-sm text-[#a09888]">
            まだ投稿がありません
          </p>
        )}
        {feed.map((o) => {
          const thumbs = o.thumb_urls?.length
            ? o.thumb_urls
            : o.image_url
              ? [o.image_url]
              : [];
          return (
            <div
              key={o.id}
              className="overflow-hidden rounded-2xl shadow-sm"
              style={{ background: "linear-gradient(160deg,#f2a35c,#e0803a)", padding: "5px 5px 0" }}
            >
              <div className="relative overflow-hidden rounded-xl bg-white px-3 py-2.5">
              <div className="relative">
              <div className="flex items-center gap-2.5">
                <Link href={`/u/${o.user_id}`} className="shrink-0">
                  <Avatar
                    name={o.profiles?.display_name ?? "参加者"}
                    url={o.profiles?.avatar_url}
                    size={36}
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-[13px] font-bold text-[#3a3428]">
                    <span className="truncate">{o.profiles?.display_name ?? "参加者"}</span>
                    <VerifiedBadge size={13} />
                    <span className="shrink-0 font-normal">さんが{KINDS[o.kind].verb}</span>
                    <img src={KINDS[o.kind].icon} alt="" className="h-4 w-4 shrink-0 object-contain" />
                  </p>
                  <p className="text-[10px] text-[#c0b8a8]">{fmtTime(o.created_at)}</p>
                </div>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-[16px] leading-relaxed text-[#3a3428]">
                {o.title ? `${o.title}\n` : ""}
                {o.detail}
              </p>
              {thumbs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {thumbs.map((t) => (
                    <img key={t} src={t} alt="" className="h-24 w-24 rounded-lg object-cover" />
                  ))}
                </div>
              )}
              </div>
              {/* 透かしワラエル */}
              <img
                src="/waraeru-v2.png"
                alt=""
                aria-hidden
                className="pointer-events-none absolute -right-6 h-28 w-28 object-contain"
                style={{
                  opacity: thumbs.length > 0 ? 0.3 : 0.12,
                  bottom: -18,
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
    </div>
  );
}

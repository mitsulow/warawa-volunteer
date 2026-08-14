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
import type { Profile } from "@/lib/db";

/* eslint-disable @next/next/no-img-element */

const KINDS: Record<
  OfferKind,
  { icon: string; label: string; verb: string }
> = {
  money: { icon: "/icons/icon-yen.webp", label: "お金を出す", verb: "お金を出します" },
  body: { icon: "/icons/icon-tasukete.webp", label: "体を出す", verb: "体を出します" },
  goods: { icon: "/icons/icon-rice.webp", label: "物資を出す", verb: "物資を出します" },
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
          お金を出す
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

  const isGoods = kind === "goods";

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
    });
    setBusy(false);
    if (e) {
      setError(`投稿できませんでした: ${e.message}`);
      return;
    }
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
            <label className="mt-3 block text-sm font-bold">
              {isGoods ? "私に出せるもの" : "私が持ち寄れるもの・アイディア・その他"}
            </label>
            <textarea
              className="mt-1 w-full rounded-xl border border-[#e8dcc4] px-3 py-2 text-[14px] leading-relaxed outline-none focus:border-[#d96a1a]"
              rows={3}
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

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <button
              className="mt-4 w-full rounded-xl py-3 font-bold text-white disabled:opacity-50"
              style={{ background: "#d96a1a" }}
              disabled={busy || uploading || !detail.trim()}
              onClick={submit}
            >
              {busy ? "投稿中…" : "投稿する"}
            </button>
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
      <div className="mb-3 grid grid-cols-4 gap-2">
        {(Object.keys(KINDS) as OfferKind[]).map((k) => (
          <button
            key={k}
            className="rounded-2xl border border-[#ede5d8] bg-white py-3.5 shadow-sm transition-transform active:scale-95"
            onClick={() => open(k)}
          >
            <img src={KINDS[k].icon} alt="" className="mx-auto h-10 w-10 object-contain" />
            <div className="mt-1 text-[12px] font-bold text-[#3a3428]">{KINDS[k].label}</div>
          </button>
        ))}
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

      <p className="mb-2 rounded-xl px-3 py-2 text-[11.5px] font-medium"
         style={{ background: "#fdf0e0", color: "#a05a10", border: "1px solid #f0d0a8" }}>
        現地の人が欲しいモノと一致したら、送付をお願いする事があります
      </p>

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
              className="rounded-xl border border-[#ede5d8] bg-white px-3 py-2.5 shadow-sm"
            >
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
              <p className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#3a3428]">
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
          );
        })}
      </div>
    </div>
  );
}

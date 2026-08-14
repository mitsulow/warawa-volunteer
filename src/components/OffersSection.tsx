"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  addOffer,
  fetchOffers,
  setOfferStatus,
  uploadPhoto,
  type Offer,
  type OfferKind,
} from "@/lib/db";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";

const KINDS: Record<
  OfferKind,
  { emoji: string; label: string; verb: string; help: string; placeholder: string }
> = {
  money: {
    emoji: "💰",
    label: "お金を出す",
    verb: "お金を出します",
    help: "寄付の意思表明です。振込先のご案内は準備中で、決まり次第お知らせします。",
    placeholder: "例: 1万円くらい / 金額未定でも「出します」だけでOK",
  },
  body: {
    emoji: "🏃",
    label: "体を出す",
    verb: "体を出します",
    help: "現地に行ける日程を書いてください。旅費は寄付金から支給されます。現地行きが決まると🟠オレンジ軍団に載ります。",
    placeholder: "例: 8/20〜8/23 行けます。車あり。力仕事OK",
  },
  goods: {
    emoji: "🍚",
    label: "物資を出す",
    verb: "物資を出します",
    help: "体に優しい食材を募集しています（現地で炊き出しに使います）。送り先は決まり次第お知らせします。写真をつけるとトップの「本日の出せる物資一覧」に載ります。",
    placeholder: "例: 今週中に送れます。無農薬です",
  },
};

/** 私にできる事: 3つの大ボタン + 意思表明一覧（物資は品名+写真つき） */
export function OffersSection({
  userId,
  isAdmin,
  requireJoin,
  openGoodsSignal = 0,
}: {
  userId: string | null;
  isAdmin: boolean;
  requireJoin: () => void;
  openGoodsSignal?: number;
}) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [formKind, setFormKind] = useState<OfferKind | null>(null);
  const [detail, setDetail] = useState("");
  const [title, setTitle] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (!userId) {
      requireJoin();
      return;
    }
    setFormKind(kind);
    setDetail("");
    setTitle("");
    setImage(null);
  };

  const submit = async () => {
    if (!userId || !formKind || !detail.trim()) return;
    if (formKind === "goods" && !title.trim()) return;
    setBusy(true);
    let imageUrl: string | null = null;
    if (formKind === "goods" && image) {
      imageUrl = await uploadPhoto(image, userId);
    }
    await addOffer(userId, formKind, detail.trim(), title.trim() || null, imageUrl);
    setBusy(false);
    setFormKind(null);
    reload();
  };

  const toggleConfirm = async (o: Offer) => {
    if (!isAdmin) return;
    await setOfferStatus(o.id, o.status === "confirmed" ? "open" : "confirmed");
    reload();
  };

  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {(Object.keys(KINDS) as OfferKind[]).map((k) => (
          <button
            key={k}
            className="rounded-2xl border border-[#ede5d8] bg-white py-4 shadow-sm transition-transform active:scale-95"
            onClick={() => open(k)}
          >
            <div className="text-3xl">{KINDS[k].emoji}</div>
            <div className="mt-1 text-sm font-bold text-[#3a3428]">{KINDS[k].label}</div>
          </button>
        ))}
      </div>

      {formKind && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setFormKind(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">
              {KINDS[formKind].emoji} {KINDS[formKind].label}
            </h3>
            <p className="mt-1 mb-3 text-sm text-[#8a8070]">{KINDS[formKind].help}</p>
            {formKind === "goods" && (
              <>
                <input
                  className="mb-2 w-full rounded-xl border border-[#e0d6c6] px-3 py-2"
                  placeholder="品名（例: お米10kg / 味噌2kg）"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={40}
                />
                <button
                  className="mb-2 w-full rounded-xl border border-dashed border-[#d96a1a] py-2 text-sm font-bold"
                  style={{ color: "#d96a1a" }}
                  onClick={() => fileRef.current?.click()}
                >
                  {image ? `📷 ${image.name}` : "📷 写真をつける（おすすめ）"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setImage(e.target.files?.[0] ?? null)}
                />
              </>
            )}
            <textarea
              className="mb-3 w-full rounded-xl border border-[#e0d6c6] px-3 py-2"
              rows={3}
              placeholder={KINDS[formKind].placeholder}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
            <button
              className="w-full rounded-xl py-3 font-bold text-white disabled:opacity-50"
              style={{ background: "#d96a1a" }}
              disabled={busy || !detail.trim() || (formKind === "goods" && !title.trim())}
              onClick={submit}
            >
              {busy ? "送信中…" : "意思表明する"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {offers.map((o) => (
          <div
            key={o.id}
            className="flex items-center gap-3 rounded-xl border border-[#ede5d8] bg-white px-3 py-2 shadow-sm"
          >
            <Link href={`/u/${o.user_id}`} className="shrink-0">
              <Avatar
                name={o.profiles?.display_name ?? "参加者"}
                url={o.profiles?.avatar_url}
                size={36}
              />
            </Link>
            {o.kind === "goods" && o.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={o.image_url}
                alt=""
                className="h-10 w-10 shrink-0 rounded-lg object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-sm font-bold text-[#3a3428]">
                <span className="truncate">
                  {o.profiles?.display_name ?? "参加者"}
                </span>
                <VerifiedBadge size={13} />
                <span className="shrink-0 font-normal">
                  さんが{KINDS[o.kind].verb} {KINDS[o.kind].emoji}
                </span>
              </p>
              <p className="truncate text-xs text-[#8a8070]">
                {o.kind === "goods" && o.title ? `${o.title} — ` : ""}
                {o.detail}
              </p>
            </div>
            {o.kind === "body" &&
              (isAdmin ? (
                <button
                  className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
                  style={
                    o.status === "confirmed"
                      ? { background: "#e8862c", color: "#fff" }
                      : { border: "1px solid #e0d6c6", color: "#8a8070" }
                  }
                  onClick={() => toggleConfirm(o)}
                >
                  {o.status === "confirmed" ? "🟠 決定済" : "現地行き決定"}
                </button>
              ) : (
                o.status === "confirmed" && (
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold text-white"
                    style={{ background: "#e8862c" }}
                  >
                    🟠 決定
                  </span>
                )
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

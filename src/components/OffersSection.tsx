"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addOffer,
  fetchGoodsRequestCounts,
  fetchMyGoodsRequests,
  type GoodsRequest,
  type GoodsRoute,
  ensureProfile,
  deleteOffer,
  fetchCommentCounts,
  fetchFeedLikes,
  fetchLikersFor,
  fetchOffers,
  fetchMoneyOfferCount,
  MONEY_FEED_LIMIT,
  toggleFeedLike,
  type Liker,
  type Offer,
  type OfferKind,
} from "@/lib/db";
import { CommentSection } from "@/components/CommentSection";
import { Linkify } from "@/components/Linkify";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { Lightbox } from "@/components/Lightbox";
import { GoodsSupportBlock } from "@/components/GoodsSupportBlock";
import { GOODS_CATEGORIES, type GoodsCategory } from "@/lib/goodsCategories";
import { CHIP_STYLE, DotsMenu, KindChip, KindFilterTabs, type ChipKind } from "@/components/PostKit";
import { ReportDialog } from "@/components/ReportDialog";
import { uploadImagePair, type ImagePair } from "@/lib/images";
import { useCropQueue } from "@/components/ImageCropper";
import { firePush } from "@/lib/push";
import { Avatar } from "@/components/Avatar";
import { BodyApplyDialog } from "@/components/BodyApplyDialog";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { EmbedCard, type OGPEmbed } from "@/components/EmbedCard";
import { SnsIcon, snsHref } from "@/components/SnsIcon";
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

/** 💰 寄付をする: 予定口数(1口1,000円)と掲示板掲載の可否を聴く。口座番号は事務局からのTalKで届く */
const UNIT_YEN = 1000;
const MAX_UNITS = 10000;
const POPULAR_UNITS = [1, 3, 5, 10, 20, 30, 50, 100];
const BANK_TEXT = "GMOあおぞらネット銀行 法人第二営業部 普通 1007941 ファミュニティリンク カ）";

function DonateDialog({
  userId,
  onClose,
  onDone,
  requireJoin,
}: {
  userId: string | null;
  onClose: () => void;
  onDone: () => void;
  requireJoin: () => void;
}) {
  const [pick, setPick] = useState<string>("1"); // "1".."100" or "custom"
  const [custom, setCustom] = useState<string>("");
  const [publish, setPublish] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const units = (() => {
    const n = pick === "custom" ? Number(custom) : Number(pick);
    return Math.min(MAX_UNITS, Math.max(1, Math.floor(n) || 1));
  })();
  const amount = units * UNIT_YEN;
  const ready = publish !== null && (pick !== "custom" || (Number(custom) >= 1 && Number(custom) <= MAX_UNITS));

  const submit = async () => {
    if (!userId) {
      requireJoin();
      return;
    }
    if (busy || publish === null) return;
    setBusy(true);
    if (publish) {
      const detail = `私は${units.toLocaleString()}口（${amount.toLocaleString()}円）の寄付をする予定です。`;
      const { error } = await addOffer(userId, "money", detail);
      if (error) {
        setBusy(false);
        window.alert(`登録できませんでした: ${error.message}`);
        return;
      }
      onDone();
    }
    if (!publish) await ensureProfile(userId);
    setBusy(false);
    // 事務局アカウントから「寄付予定X口X円・口座番号」のTalKを自動送信 + 寄付申込を保管
    firePush("/api/donate-talk", { units, listed: publish });
    setSent(true);
  };

  const copyBank = async () => {
    try {
      await navigator.clipboard.writeText(BANK_TEXT);
      setToast("口座情報をコピーしました");
    } catch {
      setToast(BANK_TEXT);
    }
    setTimeout(() => setToast(null), 1800);
  };

  const label = "text-[13px] font-extrabold text-[#3a3428]";
  const note = "text-[11.5px] leading-relaxed text-[#8a7a5a]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="py-4 text-center">
            <div className="text-4xl">🙏</div>
            <p className="mt-2 text-[16px] font-extrabold text-[#3a3428]">ありがとうございます！</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[#5a5448]">
              寄付予定 {units.toLocaleString()}口（{amount.toLocaleString()}円）を受け付けました。
              {publish && (
                <>
                  <br />
                  「私は{units.toLocaleString()}口の寄付をする予定です。」を掲示板に並べました。
                </>
              )}
              <br />
              ボランティア口座番号は事務局からのTalKに記載してあります。
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
              <img src="/icons/icon-yen.webp" alt="" className="h-7 w-7 object-contain" />
              寄付をする
            </h3>

            {/* ①②③ 説明 */}
            <div className="mt-3 space-y-2.5">
              <div>
                <p className={label}>① ご予定されている寄付額をお知らせ下さい</p>
                <p className={note}>※こちらで選択しても自動的に請求や引き落としなどはされません。</p>
                <p className={note}>※あくまでも「寄付予定額」の確認です</p>
                <p className={note}>※後ほどTalK宛に「口座番号」をお知らせします</p>
              </div>
              <p className={label}>② 両替手数料の関係上、1口1,000円以上からの寄付をお願いしております。</p>
              <p className={label}>③ 掲示板へ載せて良いかをご選択ください</p>
            </div>

            {/* 予定している寄付金額 */}
            <p className="mt-4 text-[13.5px] font-extrabold" style={{ color: "#c05e14" }}>
              「予定している寄付金額」
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <select
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                className="num h-11 flex-1 rounded-xl border bg-white px-3 text-[15px] font-bold outline-none focus:border-[#d96a1a]"
                style={{ borderColor: "#e8dcc4", color: "#3a3428" }}
              >
                {POPULAR_UNITS.map((u) => (
                  <option key={u} value={String(u)}>
                    {u}口（{(u * UNIT_YEN).toLocaleString()}円）
                  </option>
                ))}
                <option value="custom">その他の口数を入力（1〜{MAX_UNITS.toLocaleString()}口）</option>
              </select>
            </div>
            {pick === "custom" && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_UNITS}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="口数"
                  autoFocus
                  className="num h-11 w-28 rounded-xl border px-3 text-center text-[18px] font-extrabold outline-none focus:border-[#d96a1a]"
                  style={{ borderColor: "#e8dcc4", color: "#c05e14" }}
                />
                <span className="text-[14px] font-bold text-[#5a5448]">口</span>
              </div>
            )}
            <p className="num mt-1.5 text-right text-[15px] font-extrabold" style={{ color: "#c05e14" }}>
              寄付予定 {units.toLocaleString()}口 {amount.toLocaleString()}円
            </p>

            {/* 掲示板への記載 */}
            <p className="mt-4 text-[13.5px] font-extrabold" style={{ color: "#c05e14" }}>
              「掲示板への記載」
            </p>
            <div className="mt-1.5 space-y-1.5">
              {[
                { v: true, t: "寄付予定であることを掲示板に並べる", s: `「私は${units.toLocaleString()}口の寄付をする予定です。」が掲示板に並びます` },
                { v: false, t: "掲示板には並べずに寄付をする", s: "掲示板には何も表示されません" },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  onClick={() => setPublish(o.v)}
                  className="flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left"
                  style={
                    publish === o.v
                      ? { borderColor: "#d96a1a", background: "#fdf0e0" }
                      : { borderColor: "#e8dcc4", background: "#fff" }
                  }
                >
                  <span
                    className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2"
                    style={{ borderColor: publish === o.v ? "#d96a1a" : "#c8bfae" }}
                  >
                    {publish === o.v && <span className="h-[9px] w-[9px] rounded-full" style={{ background: "#d96a1a" }} />}
                  </span>
                  <span>
                    <span className="block text-[13.5px] font-bold text-[#3a3428]">{o.t}</span>
                    <span className="block text-[11px] text-[#8a7a5a]">{o.s}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* 口座情報コピー */}
            <button
              className="mt-4 w-full rounded-xl border py-2 text-[12.5px] font-bold"
              style={{ borderColor: "#d96a1a", color: "#d96a1a" }}
              onClick={copyBank}
            >
              📋 口座情報をコピーする
            </button>
            <p className="mt-1 text-center text-[10.5px] text-[#a09888]">{BANK_TEXT}</p>

            <button
              className="mt-4 w-full rounded-xl py-3 text-[14.5px] font-extrabold text-white disabled:opacity-40"
              style={{ background: "#d96a1a" }}
              disabled={busy || !ready}
              onClick={submit}
            >
              {busy ? "送信中..." : userId ? "この内容で申し込む" : "参加して申し込む"}
            </button>
            {publish === null && (
              <p className="mt-1 text-center text-[11px] text-[#c0392b]">③ 掲示板への記載を選んでください</p>
            )}
            <button className="mt-2 w-full py-2 text-[12.5px] font-bold text-[#a09888]" onClick={onClose}>
              閉じる
            </button>
          </>
        )}
        {toast && (
          <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[130] flex justify-center px-4">
            <span className="rounded-full bg-[#3a3428]/90 px-4 py-2 text-[13px] font-bold text-white shadow-lg">{toast}</span>
          </div>
        )}
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
  // 届け方（物資のみ）: オレンジ軍団に託す / 個人的に支援 / 両方可 + 数量 + 送り先の数
  const [route, setRoute] = useState<GoodsRoute>("orange");
  const [category, setCategory] = useState<GoodsCategory | null>(null);
  const [quantity, setQuantity] = useState("");
  const [slots, setSlots] = useState("1");
  const [images, setImages] = useState<ImagePair[]>([]);
  const [uploading, setUploading] = useState(false);
  const crop = useCropQueue(async (files) => {
    setUploading(true);
    const pairs: ImagePair[] = [];
    for (const f of files) {
      const pair = await uploadImagePair(userId, f);
      if (pair) pairs.push(pair);
    }
    if (pairs.length) setImages((prev) => [...prev, ...pairs].slice(0, 4));
    setUploading(false);
  });
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
    if (isGoods && !category) {
      setError("物資のジャンルを選んでください");
      return;
    }
    setBusy(true);
    setError("");
    const { error: e } = await addOffer(userId, kind, detail.trim(), null, null, {
      imageUrls: images.map((i) => i.full),
      thumbUrls: images.map((i) => i.thumb),
      embed: embed ?? null,
      route: isGoods ? route : "orange",
      category: isGoods ? category : null,
      slots: isGoods && route !== "orange" ? Math.min(999, Math.max(1, Number(slots) || 1)) : 1,
      quantity: isGoods ? quantity : null,
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
                <p>③ 返信メールに記載された住所へ、送料をお客さま負担にて発送して下さい。</p>
                <p className="font-bold" style={{ color: "#c05e14" }}>
                  ※発送は必ず「必要」の連絡が来た後にお願い致します。
                </p>
              </div>
            )}
            <label className="mt-3 block text-sm font-bold">
              {isGoods ? "私はこういう物を出せます" : "私が持ち寄れる「アイディア」や意見、その他の情報はこちらへ"}
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

            {/* 物資: ジャンル + 数量 + 届け方 */}
            {isGoods && (
              <div className="mt-3 rounded-xl border p-3" style={{ borderColor: "#e8dcc4", background: "#fffaf0" }}>
                <p className="text-[13px] font-bold text-[#3a3428]">物資のジャンル</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {GOODS_CATEGORIES.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setCategory(c.id)}
                      className="rounded-full border px-2.5 py-1 text-[12px] font-bold"
                      style={category === c.id ? { background: "#d96a1a", color: "#fff", borderColor: "#d96a1a" } : { background: "#fff", color: "#5a5448", borderColor: "#e8dcc4" }}
                    >
                      {c.emoji} {c.short}
                    </button>
                  ))}
                </div>
                {category && <p className="mt-1 text-[11px] text-[#8a7a5a]">{GOODS_CATEGORIES.find((c) => c.id === category)?.label}</p>}
                <label className="mt-3 block text-[13px] font-bold text-[#3a3428]">
                  数量 <span className="font-normal text-[#a09888]">（例：自然栽培野菜10kg、自然栽培のお米5kg、手作り味噌2kg）</span>
                </label>
                <input
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  maxLength={40}
                  placeholder="例：自然栽培野菜10kg"
                  className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-[14px] outline-none focus:border-[#d96a1a]"
                  style={{ borderColor: "#e8dcc4" }}
                />
                <p className="mt-3 text-[13px] font-bold text-[#3a3428]">届け方を選んでください</p>
                <p className="mt-1 text-[12px] font-bold" style={{ color: "#c0392b" }}>
                  ※送料については必ず支援する人の負担で物資をお届けください
                </p>
                <div className="mt-1.5 space-y-1.5">
                  {(
                    [
                      ["orange", "🟠 避難所や炊き出し所などにまとめて送る", "現地入りするチーム「オレンジ軍団」にて物資を受け取り、炊き出しの際に熊本の人に届けます。"],
                      ["direct", "🤝 個人間で直接送る", "受け取りたい人と直接個人間でやり取りをする（TalK画面で送付先などを相談し合って下さい）"],
                      ["both", "両方可能", "避難所へも、個人間でも、どちらでもOKの場合選択。"],
                    ] as Array<[GoodsRoute, string, string]>
                  ).map(([v, t, d]) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() => setRoute(v)}
                      className="flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left"
                      style={route === v ? { borderColor: "#d96a1a", background: "#fdf0e0" } : { borderColor: "#e8dcc4", background: "#fff" }}
                    >
                      <span className="mt-0.5 flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full border-2" style={{ borderColor: route === v ? "#d96a1a" : "#c8bfae" }}>
                        {route === v && <span className="h-[8px] w-[8px] rounded-full" style={{ background: "#d96a1a" }} />}
                      </span>
                      <span>
                        <span className="block text-[13px] font-bold text-[#3a3428]">{t}</span>
                        <span className="block text-[11px] text-[#8a7a5a]">{d}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {route !== "orange" && (
                  <div className="mt-2">
                    <label className="block text-[13px] font-bold text-[#3a3428]">
                      送り先は何か所まで？ <span className="font-normal text-[#a09888]">（送料はご負担いただくため）</span>
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={999}
                        value={slots}
                        onChange={(e) => setSlots(e.target.value)}
                        className="num w-24 rounded-lg border bg-white px-3 py-2 text-center text-[15px] font-bold outline-none focus:border-[#d96a1a]"
                        style={{ borderColor: "#e8dcc4" }}
                      />
                      <span className="text-[13px] text-[#5a5448]">か所（人）まで</span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#8a7a5a]">例：「自然栽培野菜10kg」を1か所にまとめて送るなら「1」、1kgずつ10人に送れるなら「10」</p>
                  </div>
                )}
              </div>
            )}

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
                    onChange={(e) => {
                      if (!e.target.files?.length || uploading) return;
                      const files = Array.from(e.target.files).slice(0, 4 - images.length);
                      e.target.value = "";
                      crop.start(files);
                    }}
                  />
                </label>
              )}
            </div>

            {crop.element}
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
  // CotoZuteと同じ記事挙動（いいね/コメント/…メニュー/折りたたみ/写真拡大）
  const [likeCounts, setLikeCounts] = useState<Map<string, number>>(new Map());
  const [reqCounts, setReqCounts] = useState<Map<string, { pending: number; accepted: number }>>(new Map());
  const [myReqs, setMyReqs] = useState<Map<string, GoodsRequest>>(new Map());
  const loadRequests = (list: Offer[]) => {
    const ids = list.filter((o) => o.kind === "goods" && o.route !== "orange").map((o) => o.id);
    fetchGoodsRequestCounts(ids).then(setReqCounts);
    if (userId) fetchMyGoodsRequests(userId).then((rs) => setMyReqs(new Map(rs.map((r) => [r.offer_id, r]))));
  };
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [likers, setLikers] = useState<Record<string, Liker[]>>({});
  const [commentCounts, setCommentCounts] = useState<Map<string, number>>(new Map());
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [expandedBody, setExpandedBody] = useState<Set<string>>(new Set());
  const [imgIdx, setImgIdx] = useState<Map<string, number>>(new Map());
  const [lightbox, setLightbox] = useState<{ urls: string[]; idx: number } | null>(null);
  const [report, setReport] = useState<{ key: string; excerpt: string } | null>(null);
  // チップをタップ → その種別だけ表示（もう一度タップ or すべて表示 で解除）
  // 最初は「物資」だけ。「すべて」で寄付・動けます・アイディアも並ぶ
  const [kindFilter, setKindFilter] = useState<ChipKind | null>("goods");

  const [moneyCount, setMoneyCount] = useState<number | null>(null);
  const reload = () =>
    fetchOffers().then((o) => {
      setOffers(o);
      loadRequests(o);
      fetchMoneyOfferCount().then(setMoneyCount).catch(() => {});
    });
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ログイン状態が確定したら「自分の希望」を取り直す
  useEffect(() => {
    if (offers.length) loadRequests(offers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    // 4種すべての記事のいいね/コメント数を取る（以前は物資・その他だけで、寄付・現地へ行くの分が消えて見えていた）
    const keys = offers.map((o) => `offer:${o.id}`).slice(0, 200);
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
    // 4ボタンとも Google ログイン必須（未ログインは参加ダイアログへ）
    if (!userId) {
      requireJoin();
      return;
    }
    setDialog(kind);
  };

  // フィードには4種すべて並ぶ（寄付=口数メッセージ / 現地へ行く=できる事 / 物資 / その他）
  const feed = offers.filter((o) => !kindFilter || o.kind === kindFilter);

  return (
    <div>
      {/* 4つの選択肢は最初から見せる（折りたたみ廃止） */}
      <div className="mb-3 grid grid-cols-4 gap-2 rounded-xl border border-[#ede5d8] bg-[#fffaf0] p-2 shadow-sm">
        {(Object.keys(KINDS) as OfferKind[]).map((k) => (
          <button
            key={k}
            className="rounded-xl border bg-white py-2 shadow-sm transition-transform active:scale-95"
            style={{ borderColor: CHIP_STYLE[k].border }}
            onClick={() => open(k)}
          >
            <img src={KINDS[k].icon} alt="" className="mx-auto h-8 w-8 object-contain" />
            <div className="mt-1 text-[12px] font-bold" style={{ color: CHIP_STYLE[k].fg }}>{KINDS[k].label}</div>
          </button>
        ))}
      </div>

      {dialog === "money" && (
        <DonateDialog
          userId={userId}
          onClose={() => setDialog(null)}
          onDone={reload}
          requireJoin={requireJoin}
        />
      )}
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
        <KindFilterTabs
          value={kindFilter}
          onChange={setKindFilter}
          counts={{
            goods: offers.filter((o) => o.kind === "goods").length,
            body: offers.filter((o) => o.kind === "body").length,
            money: moneyCount ?? offers.filter((o) => o.kind === "money").length,
            other: offers.filter((o) => o.kind === "other").length,
            all: offers.length - offers.filter((o) => o.kind === "money").length + (moneyCount ?? offers.filter((o) => o.kind === "money").length),
          }}
        />
        {feed.length === 0 && (
          <p className="mt-2 rounded-xl border border-dashed border-[#e0d6c6] bg-white py-8 text-center text-sm text-[#a09888]">
            {kindFilter ? `「${CHIP_STYLE[kindFilter].label}」の投稿はまだありません` : "まだ投稿がありません"}
          </p>
        )}
        {kindFilter === "money" && moneyCount !== null && moneyCount > MONEY_FEED_LIMIT && (
          <p className="mt-1 text-center text-[11px] text-[#a09888]">寄付の投稿 {moneyCount}件のうち最新{MONEY_FEED_LIMIT}件を表示しています</p>
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
              className="-mx-2 border-b border-[#f0ece0] bg-white"
            >
              <div className="relative overflow-hidden px-3 py-2.5">
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
                        <span className="num ml-1.5">@わらわ〜ボランティアNo.{memberNo}</span>
                      )}
                    </div>
                  </div>
                  <KindChip
                    kind={o.kind as ChipKind}
                    active={kindFilter === o.kind}
                    onClick={() => setKindFilter(kindFilter === o.kind ? null : (o.kind as ChipKind))}
                  />
                  {userId && (
                    <DotsMenu
                      canEdit={userId === o.user_id || isAdmin}
                      onEdit={() => router.push(`/post/offer/${o.id}?edit=1`)}
                      onDelete={() => removeOffer(o.id)}
                      onReport={() => setReport({ key, excerpt: body })}
                    />
                  )}
                </div>

                {/* 現地へ行く: SNS一覧（Googleのニックネーム・アイコン・SNS・PR・動ける期間だけを公開。本名/電話/住所は事務局の審査用） */}
                {o.kind === "body" && o.profiles?.sns && Object.keys(o.profiles.sns).length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {Object.entries(o.profiles.sns).map(([platform, url]) => (
                      <a
                        key={platform}
                        href={snsHref(platform, url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={platform}
                        className="flex h-8 w-8 items-center justify-center rounded-full border bg-white"
                        style={{ borderColor: "#e8dcc4" }}
                      >
                        <SnsIcon platform={platform.replace(/\d+$/, "")} size={18} />
                      </a>
                    ))}
                  </div>
                )}

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
                      <Linkify text={body} />
                    </p>
                    {needsFold(body) && !bodyExpanded && (
                      <button
                        onClick={() => setExpandedBody((p) => new Set(p).add(key))}
                        className="text-[13.5px] text-[#8a8d91]"
                      >
                        …もっと見る
                      </button>
                    )}
                    {needsFold(body) && bodyExpanded && (
                      <button
                        onClick={() =>
                          setExpandedBody((p) => {
                            const n = new Set(p);
                            n.delete(key);
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
                {embed && (
                  <div className="mt-2">
                    <EmbedCard embed={embed} />
                  </div>
                )}

                {/* 写真（左右いっぱい）。複数枚はインスタ式: 横スワイプ+●ドット */}
                {images.length > 0 && (
                  <PhotoCarousel
                    className="-mx-3 mt-2"
                    images={images}
                    thumbs={thumbs}
                    stamp={o.kind === "goods" && o.done ? "応援完了" : null}
                    stampSub={
                      o.kind === "goods" && o.done && (reqCounts.get(o.id)?.accepted ?? 0) > 0
                        ? `${reqCounts.get(o.id)!.accepted}人に届きました`
                        : null
                    }
                    onOpen={(i) => setLightbox({ urls: images, idx: i })}
                  />
                )}
                {o.kind === "goods" && o.done && images.length === 0 && (
                  <div className="mt-2 rounded-lg py-2 text-center" style={{ background: "#fdf0e0", color: "#c05e14" }}>
                    <div className="text-[15px] font-extrabold tracking-[3px]">応援完了</div>
                    <div className="text-[11.5px] font-bold">
                      {(reqCounts.get(o.id)?.accepted ?? 0) > 0 ? `${reqCounts.get(o.id)!.accepted}人に届きました` : "物資が必要な所へ届きました"}
                    </div>
                  </div>
                )}

                {/* 物資: 届け方・数量・受け取り希望・応援完了 */}
                {o.kind === "goods" && (
                  <GoodsSupportBlock
                    offer={o}
                    userId={userId}
                    isAdmin={isAdmin}
                    counts={reqCounts.get(o.id)}
                    myRequest={myReqs.get(o.id) ?? null}
                    requireJoin={requireJoin}
                    onChanged={reload}
                  />
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


                {/* いいねした人の顔（CotoZuteのFB風・ハートの下） */}
                {(likers[key]?.length ?? 0) > 0 && (
                  <div className="mt-1 flex items-center">
                    {likers[key].map((l, i) => (
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
                      {likers[key][0]?.display_name ?? ""}
                      {(likeCounts.get(key) ?? 0) > 1 ? ` 他${(likeCounts.get(key) ?? 0) - 1}人` : ""}
                    </span>
                  </div>
                )}
                {openComments.has(key) && (
                  <CommentSection
                    itemKey={key}
                    userId={userId}
                    isAdmin={isAdmin}
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

      {lightbox && <Lightbox urls={lightbox.urls} index={lightbox.idx} onClose={() => setLightbox(null)} />}
    </div>
  );
}

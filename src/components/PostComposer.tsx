"use client";

import { useEffect, useRef, useState } from "react";
import { sendBoardMessage, type BoardScope } from "@/lib/db";
import { uploadImagePair, type ImagePair } from "@/lib/images";
import { EmbedCard, type OGPEmbed } from "@/components/EmbedCard";
import { SnsIcon } from "@/components/SnsIcon";
import { DEFAULT_PREF, PREF_ORDER, fetchMunicipalities } from "@/lib/prefs";

/* eslint-disable @next/next/no-img-element */

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

/**
 * 投稿欄（OneSea CotozuteComposerと同じ挙動を共通部品化）。
 * - 折りたたみ時: アバター + 丸ボックス「(prompt)|」点滅カーソル
 * - 展開時: テキスト500字 / 写真4枚(サムネ+本体) / URL自動OGP取り込み / 下書き保存
 * - withLocation: まず「何県の何市か」を聴く（県を選ぶと隣のボックスがその県の市町村に変わる連動式）
 */
export function PostComposer({
  scope,
  prompt,
  withLocation = false,
  photoHint,
  userId,
  myAvatar,
  requireJoin,
  onPosted,
}: {
  scope: BoardScope;
  prompt: string;
  withLocation?: boolean;
  photoHint?: string;
  userId: string | null;
  myAvatar: string | null;
  requireJoin: () => void;
  onPosted: () => void;
}) {
  const draftKey = `warawa-draft-${scope}`;
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [embed, setEmbed] = useState<OGPEmbed | null>(null);
  const [loadingOGP, setLoadingOGP] = useState(false);
  const [images, setImages] = useState<ImagePair[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pref, setPref] = useState(DEFAULT_PREF);
  const [city, setCity] = useState("");
  const [cities, setCities] = useState<Record<string, string[]>>({});
  const lastFetchedUrl = useRef<string | null>(null);

  useEffect(() => {
    if (withLocation) fetchMunicipalities().then(setCities);
  }, [withLocation]);

  /* 下書き保存（CotoZuteと同じ） */
  useEffect(() => {
    try {
      const d = localStorage.getItem(draftKey);
      if (d) setBody(d);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (body) localStorage.setItem(draftKey, body);
      else localStorage.removeItem(draftKey);
    } catch {}
  }, [body, draftKey]);

  // URL自動OGP取り込み
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
    if (withLocation && !city) {
      setMessage("市町村を選んでください");
      return;
    }
    setSending(true);
    setMessage(null);
    const { error } = await sendBoardMessage(scope, userId, body.trim(), null, {
      imageUrls: images.map((i) => i.full),
      thumbUrls: images.map((i) => i.thumb),
      embed: embed ?? null,
      pref: withLocation ? pref : null,
      city: withLocation ? city : null,
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

  // 折りたたみ: アバター + 丸ボックス（CotoZuteのFB型）
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
          className="min-w-0 flex-1 truncate rounded-full border border-[#dcdfe4] bg-white px-4 py-2 text-left text-[13.5px] text-[#65676b]"
        >
          {prompt}<span className="caret-blink" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-2">
      {/* まず場所（県を選ぶと隣が市町村に連動・OneSea方式） */}
      {withLocation && (
        <p className="mb-1 text-[13px] font-bold text-[#5a5448]">助けて欲しい場所</p>
      )}
      {withLocation && (
        <div className="mb-2 flex gap-2">
          <select
            value={pref}
            onChange={(e) => {
              setPref(e.target.value);
              setCity("");
            }}
            className="w-[42%] rounded-xl border border-[#e8dcc4] bg-white px-2 py-2.5 text-[13.5px] outline-none focus:border-[#d96a1a]"
          >
            {PREF_ORDER.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-[#e8dcc4] bg-white px-2 py-2.5 text-[13.5px] outline-none focus:border-[#d96a1a]"
          >
            <option value="">市町村を選ぶ</option>
            {(cities[pref] ?? []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={prompt}
        maxLength={500}
        rows={3}
        autoFocus
        className="w-full resize-y rounded-xl border border-[#e8dcc4] bg-white p-3 text-[14px] leading-relaxed outline-none focus:border-[#d96a1a]"
      />

      {/* 写真（サムネ+本体の2枚方式・最大4枚） */}
      {photoHint && (
        <p className="mt-1.5 text-[11.5px] font-medium text-[#8a7a5a]">{photoHint}</p>
      )}
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

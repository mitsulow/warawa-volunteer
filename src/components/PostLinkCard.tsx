"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchBoardMessageById, fetchOfferById } from "@/lib/db";
import { Avatar } from "@/components/Avatar";

/* eslint-disable @next/next/no-img-element */

/** TalK本文からサイト内の記事URL(/post/board/xx・/post/offer/xx)を拾う */
const POST_URL_RE = /(?:https?:\/\/warawa-volunteer\.vercel\.app)?\/post\/(board|offer)\/([0-9a-f-]{36})/gi;

export function extractPostLinks(body: string): Array<{ type: "board" | "offer"; id: string }> {
  const out: Array<{ type: "board" | "offer"; id: string }> = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(POST_URL_RE)) {
    const key = `${m[1]}:${m[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type: m[1].toLowerCase() as "board" | "offer", id: m[2] });
  }
  return out.slice(0, 3);
}

interface CardData {
  authorName: string;
  authorAvatar: string | null;
  memberNo: number | null;
  excerpt: string;
  image: string | null;
  label: string;
  labelColor: string;
}

/** TalKの中に出す記事カード（タップで記事へ）。LINEのシェアカード風 */
export function PostLinkCard({ type, id }: { type: "board" | "offer"; id: string }) {
  const [card, setCard] = useState<CardData | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (type === "board") {
        const b = await fetchBoardMessageById(id);
        if (!alive) return;
        if (!b) return setCard(null);
        setCard({
          authorName: b.profiles?.display_name ?? "参加者",
          authorAvatar: b.profiles?.avatar_url ?? null,
          memberNo: b.profiles?.member_no ?? null,
          excerpt: b.body.replace(/https?:\/\/\S+/g, "").trim().slice(0, 90),
          image: b.thumb_urls?.[0] ?? b.image_url ?? null,
          label: b.scope === "voice" ? "🆘 助けて" : "💬 掲示板",
          labelColor: b.scope === "voice" ? "#c0392b" : "#c05e14",
        });
      } else {
        const o = await fetchOfferById(id);
        if (!alive) return;
        if (!o) return setCard(null);
        setCard({
          authorName: o.profiles?.display_name ?? "参加者",
          authorAvatar: o.profiles?.avatar_url ?? null,
          memberNo: o.profiles?.member_no ?? null,
          excerpt: (o.title ? `${o.title} ` : "") + o.detail.replace(/https?:\/\/\S+/g, "").trim().slice(0, 90),
          image: o.thumb_urls?.[0] ?? o.image_url ?? null,
          label: "🍀 助けたい",
          labelColor: "#2e7d4f",
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [type, id]);

  if (card === undefined) return <div className="mt-1.5 h-20 w-64 max-w-full animate-pulse rounded-xl bg-black/5" />;
  if (card === null) return null;

  return (
    <Link
      href={`/post/${type}/${id}`}
      className="mt-1.5 block w-72 max-w-full overflow-hidden rounded-xl border-2 bg-white text-left no-underline shadow-sm active:opacity-80"
      style={{ borderColor: card.labelColor }}
    >
      <div className="flex items-center justify-between px-2.5 pt-1.5">
        <span className="text-[11px] font-extrabold" style={{ color: card.labelColor }}>{card.label}</span>
        <span className="text-[10px] font-bold text-[#a09888]">記事を開く →</span>
      </div>
      <div className="flex gap-2 px-2.5 py-1.5">
        {card.image && <img src={card.image} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-[#ede5d8] object-cover" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <Avatar name={card.authorName} url={card.authorAvatar} size={16} />
            <span className="truncate text-[11px] font-bold text-[#5a5448]">{card.authorName}</span>
            {card.memberNo != null && <span className="num text-[9.5px] text-[#a09888]">No.{card.memberNo}</span>}
          </div>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[12px] leading-snug text-[#3a3428]" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {card.excerpt}
          </p>
        </div>
      </div>
    </Link>
  );
}

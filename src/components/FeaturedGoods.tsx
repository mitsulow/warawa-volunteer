"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Offer } from "@/lib/db";

/**
 * 本日の出せる物資一覧（楽市楽座「本日のパワープッシュ楽座」を移植）。
 * 画像つき物資から日替わりで最大6件、4.5秒ごとに自動回転・スワイプ可。
 */
export function FeaturedGoods({ offers }: { offers: Offer[] }) {
  const withImage = offers.filter(
    (o) => o.kind === "goods" && (o.image_urls?.length || o.image_url)
  );
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const picks: Offer[] = [];
  if (withImage.length > 0) {
    const start = dayOfYear % withImage.length;
    const count = Math.min(6, withImage.length);
    for (let i = 0; i < count; i++) picks.push(withImage[(start + i) % withImage.length]);
  }

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    if (picks.length <= 1 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % picks.length), 4500);
    return () => clearInterval(t);
  }, [picks.length, paused]);

  useEffect(() => {
    if (index >= picks.length) setIndex(0);
  }, [picks.length, index]);

  if (picks.length === 0) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
    setPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(dx) > 40)
      setIndex((i) => (i + (dx > 0 ? -1 : 1) + picks.length) % picks.length);
    touchStart.current = null;
    setTimeout(() => setPaused(false), 1000);
  };

  return (
    <div
      className="overflow-hidden rounded-2xl border-2 shadow-md"
      style={{ borderColor: "#d96a1a", background: "linear-gradient(135deg,#fdf6e9 0%,#f5e8d5 100%)" }}
    >
      {/* リボン */}
      <div
        className="flex items-center justify-center gap-2 px-3 py-1"
        style={{ background: "linear-gradient(90deg,#d96a1a 0%,#f08a30 50%,#d96a1a 100%)" }}
      >
        {picks.length > 1 && (
          <div className="flex flex-shrink-0 gap-1">
            {picks.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setIndex(i);
                  setPaused(true);
                  setTimeout(() => setPaused(false), 4000);
                }}
                aria-label={`物資 ${i + 1}`}
                className="rounded-full transition-all"
                style={{
                  width: i === index ? 14 : 5,
                  height: 5,
                  background: i === index ? "white" : "rgba(255,255,255,0.5)",
                }}
              />
            ))}
          </div>
        )}
        <span className="whitespace-nowrap text-[11px] font-bold tracking-widest text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-goldstar.webp" alt="" style={{ width: 16, height: 16, display: "inline", verticalAlign: -3 }} />{" "}
          本日の出せる物資一覧{" "}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-goldstar.webp" alt="" style={{ width: 16, height: 16, display: "inline", verticalAlign: -3 }} />
        </span>
      </div>

      {/* スライド */}
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {picks.map((o) => (
            <Link
              key={o.id}
              href={`/u/${o.user_id}`}
              className="block w-full flex-shrink-0 no-underline"
            >
              <div className="flex h-24">
                <div className="relative w-24 flex-shrink-0 overflow-hidden bg-[#f2ede4]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={o.thumb_urls?.[0] ?? o.image_urls?.[0] ?? o.image_url!}
                    alt={o.title ?? ""}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between overflow-hidden p-2">
                  <div className="min-w-0">
                    <h2 className="line-clamp-1 text-sm font-bold leading-tight text-[#3a3428]">
                      {o.title ?? o.detail}
                    </h2>
                    <p className="line-clamp-1 text-[10.5px] text-[#8a8070]">{o.detail}</p>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1">
                      {o.profiles?.avatar_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={o.profiles.avatar_url}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-6 w-6 rounded-full object-cover"
                        />
                      )}
                      <span className="truncate text-[10px] text-[#8a8070]">
                        {o.profiles?.display_name ?? ""}
                      </span>
                    </div>
                    <div className="flex-shrink-0 text-[11px] font-bold" style={{ color: "#d96a1a" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/icons/icon-rice.webp" alt="" style={{ width: 13, height: 13, display: "inline", verticalAlign: -2 }} /> 物資
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

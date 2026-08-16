"use client";

import { useState } from "react";

/* eslint-disable @next/next/no-img-element */

/**
 * 投稿写真のカルーセル（全フィード共通）。
 * 1枚だけ表示・左右スワイプ・写真の下端に ○○●○○ を重ねて、左右にも写真があると分かるように。
 * 1枚のときはドット無し・元の縦横比。2枚以上は 4:3 に揃える（切り抜きの既定比率と同じ）。
 */
export function PhotoCarousel({
  images,
  thumbs,
  onOpen,
  className = "",
}: {
  images: string[];
  thumbs?: string[];
  onOpen?: (idx: number) => void;
  className?: string;
}) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) return null;
  const src = (i: number) => thumbs?.[i] ?? images[i];

  if (images.length === 1) {
    return (
      <div className={className}>
        <button onClick={() => onOpen?.(0)} className="block w-full" aria-label="写真をフル画質で見る">
          <img src={src(0)} alt="" className="w-full object-cover" />
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div
        className="hide-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== idx) setIdx(i);
        }}
      >
        {images.map((full, i) => (
          <button
            key={full}
            onClick={() => onOpen?.(i)}
            className="w-full flex-shrink-0 snap-center"
            aria-label={`写真${i + 1}/${images.length}`}
          >
            <img src={src(i)} alt="" className="h-full w-full object-cover" style={{ aspectRatio: "4 / 3" }} />
          </button>
        ))}
      </div>
      {/* ○○●○○ を写真に重ねる */}
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {images.map((_, i) => (
          <span
            key={i}
            className="rounded-full"
            style={{
              width: i === idx ? 8 : 6,
              height: i === idx ? 8 : 6,
              background: i === idx ? "#fff" : "rgba(255,255,255,.55)",
              boxShadow: "0 0 3px rgba(0,0,0,.6)",
              transition: "all .15s",
            }}
          />
        ))}
      </div>
      {/* 枚数バッジ（右上） */}
      <span className="num pointer-events-none absolute right-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[10.5px] font-bold text-white">
        {idx + 1}/{images.length}
      </span>
    </div>
  );
}

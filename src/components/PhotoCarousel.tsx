"use client";

import { useState } from "react";

/* eslint-disable @next/next/no-img-element */

/**
 * 投稿写真のカルーセル（全フィード共通）。
 * 1枚だけ表示・左右スワイプ・写真の下端に ○○●○○ を重ねて、左右にも写真があると分かるように。
 * 1枚のときはドット無し・元の縦横比。2枚以上は 4:3 に揃える（切り抜きの既定比率と同じ）。
 */
export function Stamp({ text }: { text: string }) {
  return (
    <span
      className="pointer-events-none absolute left-1/2 top-1/2 z-10 whitespace-nowrap border-[3px] px-3 py-1 text-[17px] font-extrabold tracking-[3px]"
      style={{
        transform: "translate(-50%,-50%) rotate(-16deg)",
        color: "#c05e14",
        borderColor: "#c05e14",
        background: "rgba(255,255,255,.72)",
        boxShadow: "0 2px 8px rgba(0,0,0,.15)",
      }}
    >
      {text}
    </span>
  );
}

export function PhotoCarousel({
  images,
  thumbs,
  onOpen,
  className = "",
  stamp,
}: {
  images: string[];
  thumbs?: string[];
  onOpen?: (idx: number) => void;
  className?: string;
  /** 「応援完了」などのスタンプを写真に重ねる（SOLD OUT相当・写真は少し灰色に） */
  stamp?: string | null;
}) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) return null;
  const src = (i: number) => thumbs?.[i] ?? images[i];
  const imgStyle = stamp ? { filter: "grayscale(.7)", opacity: 0.85 } : undefined;

  if (images.length === 1) {
    return (
      <div className={`relative ${className}`}>
        <button onClick={() => onOpen?.(0)} className="block w-full" aria-label="写真をフル画質で見る">
          <img src={src(0)} alt="" className="w-full object-cover" style={imgStyle} />
        </button>
        {stamp && <Stamp text={stamp} />}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {stamp && <Stamp text={stamp} />}
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
            <img src={src(i)} alt="" className="h-full w-full object-cover" style={{ aspectRatio: "4 / 3", ...(imgStyle ?? {}) }} />
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

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* eslint-disable @next/next/no-img-element */

/**
 * 写真のフル画面ビューア（全フィード・ポスター共通）。
 * - 左右スワイプで前後の写真（横スクロール・スナップ）
 * - 2本指ピンチ / ダブルタップで拡大（拡大中はドラッグで移動、拡大中は横スワイプで切替しない）
 * - 上部に「2/5」・✕。背景タップで閉じる
 */
export function Lightbox({ urls, index, onClose }: { urls: string[]; index: number; onClose: () => void }) {
  const [idx, setIdx] = useState(index);
  const scroller = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);

  // 最初の位置へスクロール
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = index * el.clientWidth;
  }, [index]);
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);
  // 写真が変わったら拡大を戻す
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [idx]);

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom };
      drag.current = null;
    } else if (zoom > 1) {
      drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = Array.from(pointers.current.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      setZoom(Math.min(5, Math.max(1, (pinch.current.z * d) / pinch.current.d)));
      e.preventDefault();
      return;
    }
    if (drag.current && zoom > 1) {
      drag.current.moved = true;
      setPan({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      const wasDrag = drag.current?.moved;
      drag.current = null;
      if (zoom < 1.05) {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
      // ダブルタップで 1x ⇔ 2.5x
      const now = Date.now();
      if (!wasDrag && now - lastTap.current < 300) {
        setZoom((z) => (z > 1 ? 1 : 2.5));
        setPan({ x: 0, y: 0 });
        lastTap.current = 0;
      } else {
        lastTap.current = now;
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[180] bg-black/95" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+10px)]">
        <span className="num rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-bold text-white">
          {idx + 1}/{urls.length}
        </span>
        <button onClick={onClose} className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white" aria-label="閉じる">
          ✕
        </button>
      </div>
      <div
        ref={scroller}
        className="hide-scrollbar flex h-full w-full snap-x snap-mandatory items-center overflow-x-auto"
        style={{ overflowX: zoom > 1 ? "hidden" : "auto", touchAction: zoom > 1 ? "none" : "pan-x" }}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== idx) setIdx(i);
        }}
      >
        {urls.map((u, i) => (
          <div
            key={u}
            className="flex h-full w-full flex-shrink-0 snap-center items-center justify-center"
            onClick={(e) => e.target === e.currentTarget && onClose()}
          >
            <img
              src={u}
              alt=""
              draggable={false}
              className="max-h-full max-w-full select-none object-contain"
              style={
                i === idx
                  ? {
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      transition: pinch.current || drag.current ? "none" : "transform .12s",
                      // 等倍のときは写真の上でも横スワイプ(ネイティブスクロール)が効くように pan-x を許可。拡大中だけ全部こちらで扱う
                      touchAction: zoom > 1 ? "none" : "pan-x",
                    }
                  : { touchAction: "pan-x" }
              }
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          </div>
        ))}
      </div>
      {urls.length > 1 && zoom === 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+14px)] flex justify-center gap-1.5">
          {urls.map((_, i) => (
            <span key={i} className="rounded-full" style={{ width: i === idx ? 8 : 6, height: i === idx ? 8 : 6, background: i === idx ? "#fff" : "rgba(255,255,255,.45)" }} />
          ))}
        </div>
      )}
      {zoom === 1 && (
        <p className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+34px)] text-center text-[10.5px] text-white/60">
          ダブルタップ / 2本指で拡大
        </p>
      )}
    </div>,
    document.body
  );
}

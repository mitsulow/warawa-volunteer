"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * TalKの吹き出し長押しメニュー（LINE風）。
 * 使い方: const lp = useLongPress(() => setMenu({...})); <div {...lp.handlers}>…</div>
 * スマホは長押し(500ms)・PCは右クリック。スクロールで指が動いたら取り消し。
 */
export function useLongPress(onLongPress: (x: number, y: number) => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      const { clientX, clientY } = e;
      timer.current = setTimeout(() => {
        fired.current = true;
        if (navigator.vibrate) navigator.vibrate(15);
        onLongPress(clientX, clientY);
      }, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current) return;
      if (Math.abs(e.clientX - start.current.x) > 8 || Math.abs(e.clientY - start.current.y) > 8) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      if (!fired.current) onLongPress(e.clientX, e.clientY);
    },
  };
  return { handlers };
}

export interface BubbleMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

/** 長押し位置の近くに出る小さなメニュー（portal・外タップで閉じる） */
export function BubbleMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: BubbleMenuItem[];
  onClose: () => void;
}) {
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: x, top: y });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.min(Math.max(8, x - w / 2), window.innerWidth - w - 8);
    const top = y - h - 12 > 8 ? y - h - 12 : y + 12;
    setPos({ left, top });
  }, [x, y]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[125]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        ref={ref}
        className="fixed z-[126] flex overflow-hidden rounded-xl bg-[#3a3428] shadow-xl"
        style={{ left: pos.left, top: pos.top }}
      >
        {items.map((it, i) => (
          <button
            key={it.label}
            onClick={() => {
              onClose();
              it.onClick();
            }}
            className={`px-4 py-2.5 text-[13.5px] font-bold text-white active:bg-white/10 ${
              i > 0 ? "border-l border-white/15" : ""
            } ${it.danger ? "text-[#ff8a80]" : ""}`}
            style={it.danger ? { color: "#ff9a8a" } : undefined}
          >
            {it.label}
          </button>
        ))}
      </div>
    </>,
    document.body
  );
}

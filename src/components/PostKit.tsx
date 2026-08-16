"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

/** 記事の種別チップ。項目別に色分け（物資=オレンジ / 持ち寄り=緑）。タップでその種別だけの絞り込み */
export type ChipKind = "money" | "body" | "goods" | "other";
export const CHIP_STYLE: Record<ChipKind, { label: string; bg: string; fg: string; border: string }> = {
  money: { label: "寄付をする", bg: "#fff6d6", fg: "#9a6b00", border: "#f0d98a" },
  goods: { label: "物資を送る", bg: "#fdf0e0", fg: "#c05e14", border: "#f0d0a8" },
  body: { label: "現地へ行く", bg: "#e6f0fb", fg: "#1f5fa8", border: "#bcd4f2" },
  other: { label: "持ち寄ります", bg: "#e6f4ea", fg: "#2e7d4f", border: "#b8dfc4" },
};

export function KindChip({
  kind,
  active = false,
  onClick,
}: {
  kind: ChipKind;
  active?: boolean;
  onClick?: () => void;
}) {
  const c = CHIP_STYLE[kind];
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={
        active
          ? { background: c.fg, color: "#fff", border: `1px solid ${c.fg}` }
          : { background: c.bg, color: c.fg, border: `1px solid ${c.border}` }
      }
      aria-pressed={active}
      title={active ? "絞り込みを解除" : `「${c.label}」だけを見る`}
    >
      {c.label}
    </button>
  );
}

/** 絞り込み中の帯（フィード上部）: 「◯◯」だけを表示中 ／ すべて表示 */
export function KindFilterBar({
  kind,
  onClear,
}: {
  kind: ChipKind | null;
  onClear: () => void;
}) {
  if (!kind) return null;
  const c = CHIP_STYLE[kind];
  return (
    <div
      className="-mx-2 mb-0 flex items-center justify-between border-b px-3 py-1.5 text-[12.5px] font-bold"
      style={{ background: c.bg, color: c.fg, borderColor: c.border }}
    >
      <span>「{c.label}」だけを表示中</span>
      <button onClick={onClear} className="rounded-full bg-white px-2.5 py-[3px] text-[11.5px]" style={{ color: c.fg, border: `1px solid ${c.border}` }}>
        すべて表示
      </button>
    </div>
  );
}

/** 投稿カード右上の「⋯」メニュー（OneSea PostKitから移植: 編集/削除/通報） */
export function DotsMenu({
  canEdit,
  onEdit,
  onDelete,
  onReport,
}: {
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReport?: () => void;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const item = "block w-full px-5 py-2.5 text-center text-[13.5px] font-bold";
  return (
    <>
      <button
        ref={btn}
        onClick={() => {
          if (pos) {
            setPos(null);
            return;
          }
          const r = btn.current!.getBoundingClientRect();
          setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
        }}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full active:bg-[#f0f2f5]"
        aria-label="投稿メニュー"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#5a5d61">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[125]" onClick={() => setPos(null)} />
            <div
              className="fixed z-[126] overflow-hidden whitespace-nowrap rounded-2xl border border-[#e8eaed] bg-white py-1 shadow-xl"
              style={{ top: pos.top, right: pos.right }}
            >
              <button
                onClick={() => {
                  if (!canEdit) return;
                  setPos(null);
                  onEdit();
                }}
                disabled={!canEdit}
                className={`${item} ${canEdit ? "text-[#1c1e21] active:bg-[#f0f2f5]" : "cursor-default text-[#c8ccd1]"}`}
              >
                編集
              </button>
              <div className="mx-3 h-px bg-[#f0f2f5]" />
              <button
                onClick={() => {
                  if (!canEdit) return;
                  setPos(null);
                  onDelete();
                }}
                disabled={!canEdit}
                className={`${item} ${canEdit ? "text-[#e0455a] active:bg-[#f0f2f5]" : "cursor-default text-[#c8ccd1]"}`}
              >
                削除
              </button>
              {onReport && (
                <>
                  <div className="mx-3 h-px bg-[#f0f2f5]" />
                  <button
                    onClick={() => {
                      setPos(null);
                      onReport();
                    }}
                    className={`${item} text-[#65676b] active:bg-[#f0f2f5]`}
                  >
                    通報
                  </button>
                </>
              )}
            </div>
          </>,
          document.body
        )}
    </>
  );
}

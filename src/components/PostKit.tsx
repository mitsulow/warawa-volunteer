"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

/** 記事の種別チップ。項目別に色分け（物資=オレンジ / 持ち寄り=緑）。タップでその種別だけの絞り込み */
export type ChipKind = "money" | "body" | "goods" | "other";
export const CHIP_STYLE: Record<ChipKind, { label: string; bg: string; fg: string; border: string }> = {
  money: { label: "寄付します", bg: "#fff6d6", fg: "#9a6b00", border: "#f0d98a" },
  goods: { label: "物資を送れます", bg: "#fdf0e0", fg: "#c05e14", border: "#f0d0a8" },
  body: { label: "動けます", bg: "#e6f0fb", fg: "#1f5fa8", border: "#bcd4f2" },
  other: { label: "アイディア", bg: "#e6f4ea", fg: "#2e7d4f", border: "#b8dfc4" },
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

/**
 * ジャンル切替バー（フィード上部・薄い1段）: 物資 / 動けます / 寄付 / アイディア / すべて。
 * 旧「「◯◯」だけを表示中」帯と同じ厚み(py-1.5)に収める。
 */
const FILTER_ORDER: Array<ChipKind | null> = ["goods", "body", "money", "other", null];
const FILTER_SHORT: Record<string, string> = {
  goods: "物資",
  body: "動けます",
  money: "寄付",
  other: "アイディア",
  all: "すべて",
};

export function KindFilterTabs({
  value,
  onChange,
  counts,
}: {
  value: ChipKind | null;
  onChange: (k: ChipKind | null) => void;
  counts?: Partial<Record<ChipKind | "all", number>>;
}) {
  return (
    <div
      className="-mx-2 flex items-center gap-1 overflow-x-auto border-b px-2 py-1.5"
      style={{ background: "#fffaf0", borderColor: "#f0e6d2", scrollbarWidth: "none" }}
      role="tablist"
      aria-label="ジャンルで絞り込む"
    >
      {FILTER_ORDER.map((k) => {
        const key = k ?? "all";
        const active = value === k;
        const c = k ? CHIP_STYLE[k] : { bg: "#f0e9da", fg: "#5a5448", border: "#e0d6c6", label: "すべて" };
        const n = counts?.[key as ChipKind | "all"];
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(k)}
            className="flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 text-[12px] font-bold transition-colors"
            style={
              active
                ? { background: c.fg, color: "#fff", border: `1px solid ${c.fg}` }
                : { background: "#fff", color: c.fg, border: `1px solid ${c.border}` }
            }
          >
            {FILTER_SHORT[key]}
            {typeof n === "number" && n > 0 && (
              <span
                className="num rounded-full px-1.5 text-[10px] leading-4"
                style={active ? { background: "rgba(255,255,255,.28)" } : { background: c.bg }}
              >
                {n}
              </span>
            )}
          </button>
        );
      })}
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

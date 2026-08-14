"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

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

"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * シェアボタン（アイコン行の右端）。スマホは共有シート、PCはリンクをコピー。
 * 共有先ではOGP（/post/…/layout.tsx）が本文と写真つきカードで開く。
 */
export function ShareButton({
  path,
  title,
  text,
}: {
  path: string;
  title?: string;
  text?: string;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const share = async () => {
    const url = `${window.location.origin}${path}`;
    const excerpt = (text ?? "").replace(/\s+/g, " ").slice(0, 80);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: title ?? "わらわ〜ボランティア", text: excerpt, url });
        return;
      }
    } catch {
      return; // ユーザーが共有をやめた
    }
    try {
      await navigator.clipboard.writeText(url);
      setToast("リンクをコピーしました");
    } catch {
      setToast(url);
    }
    setTimeout(() => setToast(null), 1800);
  };
  return (
    <>
      <button className="flex items-center gap-1" onClick={share} aria-label="シェア">
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#d96a1a" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.5 3.5 10.8 13.2" />
          <path d="M20.5 3.5 14.2 20.5l-3.4-7.3-7.3-3.4z" />
        </svg>
      </button>
      {toast &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[130] flex justify-center px-4">
            <span className="rounded-full bg-[#3a3428]/90 px-4 py-2 text-[13px] font-bold text-white shadow-lg">
              {toast}
            </span>
          </div>,
          document.body
        )}
    </>
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

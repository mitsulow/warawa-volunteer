"use client";

import { useEffect, useRef } from "react";

/**
 * TalK用の入力欄。改行できる自動伸縮textarea（1〜6行）。
 * スマホ(タッチ端末)は Enter=改行・送信はボタンのみ。PCは Enter=送信 / Shift+Enter=改行。
 */
export function MessageInput({
  value,
  onChange,
  onSend,
  placeholder,
  disabled = false,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 6 * 24 + 16)}px`;
  }, [value]);

  const isTouch = () =>
    typeof window !== "undefined" &&
    (window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      enterKeyHint="enter"
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
        if (isTouch()) return; // スマホは改行
        e.preventDefault();
        onSend();
      }}
      className={`min-h-[40px] max-h-[160px] flex-1 resize-none rounded-xl border px-3 py-2 text-[15px] leading-6 outline-none focus:border-[#d96a1a] ${className}`}
    />
  );
}

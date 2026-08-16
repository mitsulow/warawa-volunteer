"use client";

import type { ReactNode } from "react";

const URL_RE = /(https?:\/\/[^\s<>"'）)】\]]+)/g;

/** 本文中の http(s) リンクをタップで開けるようにする（新しいタブ）。他は素のテキストのまま */
export function Linkify({ text, className }: { text: string; className?: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const i = m.index ?? 0;
    if (i > last) parts.push(text.slice(last, i));
    const url = m[0];
    parts.push(
      <a
        key={`${i}-${url}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={className ?? "break-all underline"}
        style={{ color: "#c05e14" }}
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    );
    last = i + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

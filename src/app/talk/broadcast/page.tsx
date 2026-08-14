"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/useSession";
import {
  fetchBroadcasts,
  markBroadcastRead,
  sendBroadcast,
  type Broadcast,
} from "@/lib/db";

/* eslint-disable @next/next/no-img-element */

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 📢 事務局からのお知らせ（一斉配信・OneSea broadcast方式）。送信は事務局のみ */
export default function BroadcastPage() {
  const session = useSession();
  const [items, setItems] = useState<Broadcast[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setItems(await fetchBroadcasts());
    setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
  };

  useEffect(() => {
    load();
    if (session.userId) markBroadcastRead(session.userId);
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.userId]);

  const send = async () => {
    if (!session.userId || !body.trim() || busy) return;
    setBusy(true);
    const { error } = await sendBroadcast(session.userId, body.trim());
    setBusy(false);
    if (error) {
      alert("送信できませんでした: " + error.message);
      return;
    }
    setBody("");
    load();
  };

  return (
    <main className="flex h-dvh flex-col" style={{ background: "#faf6ee" }}>
      <header
        className="sticky top-0 flex items-center gap-3 px-4 py-3 text-white"
        style={{ background: "linear-gradient(120deg,#d96a1a,#a84e0e)" }}
      >
        <Link href="/talk" className="text-xl text-white no-underline" aria-label="戻る">
          ←
        </Link>
        <span className="text-xl">📢</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">事務局からのお知らせ</p>
          <p className="text-[10px] leading-tight opacity-85">全員に届く一斉配信です</p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {items.length === 0 && (
          <p className="py-10 text-center text-sm text-[#a09888]">
            まだお知らせはありません
          </p>
        )}
        {items.map((b) => (
          <div
            key={b.id}
            className="rounded-2xl border bg-white p-3.5 shadow-sm"
            style={{ borderColor: "#f0d0a8" }}
          >
            <div className="flex items-center gap-2">
              <img src="/waraeru-v2.png" alt="" className="h-6 w-6 object-contain" />
              <span className="text-[12px] font-bold" style={{ color: "#c05e14" }}>
                事務局{b.profiles?.display_name ? `（${b.profiles.display_name}）` : ""}
              </span>
              <span className="ml-auto text-[10px] text-[#b8b0a0]">{fmtTime(b.created_at)}</span>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#3a3428]">
              {b.body}
            </p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {session.isAdmin && (
        <div className="flex gap-2 border-t border-[#ede5d8] bg-white p-3">
          <input
            className="flex-1 rounded-xl border border-[#e0d6c6] px-3 py-2"
            placeholder="全員へのお知らせを書く（例: 明日◯◯で炊き出しをやります）"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            className="rounded-xl px-4 font-bold text-white disabled:opacity-50"
            style={{ background: "#d96a1a" }}
            disabled={busy}
            onClick={send}
          >
            配信
          </button>
        </div>
      )}
    </main>
  );
}

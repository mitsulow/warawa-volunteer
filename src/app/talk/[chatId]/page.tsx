"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/useSession";
import {
  fetchChatPartner,
  fetchDm,
  fetchDmSince,
  markDmRead,
  sendDm,
  type DmMessage,
  type Profile,
} from "@/lib/db";
import { Avatar } from "@/components/Avatar";

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 1対1 Talk。5秒ポーリング・増分取得（OneSea方式） */
export default function TalkPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = use(params);
  const session = useSession();
  const [partner, setPartner] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const myId = session.userId;

  useEffect(() => {
    if (!myId) return;
    let alive = true;
    fetchChatPartner(chatId, myId).then((p) => alive && setPartner(p));
    fetchDm(chatId).then((rows) => {
      if (!alive) return;
      setMessages(rows);
      if (rows.length) cursorRef.current = rows[rows.length - 1].created_at;
      markDmRead(chatId, myId);
      setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
    });
    const timer = setInterval(async () => {
      if (document.hidden || !cursorRef.current) return;
      const fresh = await fetchDmSince(chatId, cursorRef.current);
      if (!alive || fresh.length === 0) return;
      cursorRef.current = fresh[fresh.length - 1].created_at;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
      });
      markDmRead(chatId, myId);
      setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
    }, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [chatId, myId]);

  const send = async () => {
    if (!myId || !body.trim()) return;
    setBusy(true);
    await sendDm(chatId, myId, body.trim());
    setBody("");
    setBusy(false);
    const fresh = await fetchDmSince(chatId, cursorRef.current ?? "1970-01-01");
    if (fresh.length) {
      cursorRef.current = fresh[fresh.length - 1].created_at;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
      });
    }
    setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
  };

  if (!session.loading && !myId) {
    return (
      <main className="p-6 text-center">
        <p className="mb-4">Talkを使うにはトップページから参加してください。</p>
        <Link href="/" className="text-[#1e6b3a] font-bold underline">
          ← トップへ戻る
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col h-dvh">
      <header className="flex items-center gap-3 px-4 py-3 bg-[#1e6b3a] text-white sticky top-0">
        <Link href="/talk" className="text-xl" aria-label="戻る">
          ←
        </Link>
        {partner && (
          <>
            <Avatar name={partner.display_name} url={partner.avatar_url} size={32} />
            <span className="font-bold">{partner.display_name || "参加者"}</span>
          </>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.map((m) => {
          const mine = m.sender_id === myId;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                  mine ? "bg-[#1e6b3a] text-white" : "bg-white shadow-sm"
                }`}
              >
                {m.body}
                <span
                  className={`block text-[10px] mt-0.5 ${mine ? "text-white/70" : "text-gray-400"}`}
                >
                  {fmtTime(m.created_at)}
                  {mine && m.read_at ? " 既読" : ""}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 p-3 bg-white border-t border-gray-200">
        <input
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2"
          placeholder="メッセージを書く"
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
          className="rounded-xl bg-[#1e6b3a] px-4 text-white font-bold disabled:opacity-50"
          disabled={busy}
          onClick={send}
        >
          送信
        </button>
      </div>
    </main>
  );
}

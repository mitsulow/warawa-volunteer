"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchBoard,
  fetchBoardSince,
  markGroupRead,
  sendBoardMessage,
  uploadPhoto,
  type BoardMessage,
  type BoardScope,
} from "@/lib/db";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * グループ掲示板フィード（掲示板風UI）。
 * 同じデータがTalKタブのグループトークにも出る（OneSeaのgroup_messages同期方式）。
 * 初回だけ全件、その後は5秒ポーリングで増分のみ。hidden中は停止。
 */
export function GroupFeed({
  scope,
  userId,
  requireJoin,
  placeholder,
}: {
  scope: BoardScope;
  userId: string | null;
  requireJoin: () => void;
  placeholder: string;
}) {
  const [messages, setMessages] = useState<BoardMessage[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    fetchBoard(scope).then((rows) => {
      if (!alive) return;
      setMessages(rows);
      if (rows.length) cursorRef.current = rows[rows.length - 1].created_at;
      if (userId) markGroupRead(scope, userId);
    });
    const timer = setInterval(async () => {
      if (document.hidden || !cursorRef.current) return;
      const fresh = await fetchBoardSince(scope, cursorRef.current);
      if (!alive || fresh.length === 0) return;
      cursorRef.current = fresh[fresh.length - 1].created_at;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
      });
      if (userId) markGroupRead(scope, userId);
    }, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [scope, userId]);

  const pull = async () => {
    const fresh = await fetchBoardSince(scope, cursorRef.current ?? "1970-01-01");
    if (fresh.length) {
      cursorRef.current = fresh[fresh.length - 1].created_at;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
      });
    }
  };

  const send = async (imageUrl?: string | null) => {
    if (!userId) {
      requireJoin();
      return;
    }
    const text = body.trim();
    if (!text && !imageUrl) return;
    setBusy(true);
    await sendBoardMessage(scope, userId, text, imageUrl);
    setBody("");
    setBusy(false);
    pull();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;
    setBusy(true);
    const url = await uploadPhoto(file, userId);
    setBusy(false);
    if (url) await send(url);
  };

  return (
    <div>
      {/* 書き込み欄（上部・掲示板スタイル） */}
      <div className="mb-3 flex gap-2">
        <button
          className="rounded-xl border border-[#e0d6c6] bg-white px-3 text-xl"
          onClick={() => (userId ? fileRef.current?.click() : requireJoin())}
          disabled={busy}
          aria-label="写真を送る"
        >
          📷
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={onFile}
        />
        <input
          className="flex-1 rounded-xl border border-[#e0d6c6] bg-white px-3 py-2 text-[14px]"
          placeholder={userId ? placeholder : "ログインすると書き込めます"}
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
          onClick={() => send()}
        >
          送信
        </button>
      </div>

      {/* カード一覧（新しい順） */}
      <div className="space-y-2.5">
        {messages.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#e0d6c6] bg-white py-8 text-center text-sm text-[#a09888]">
            まだ書き込みがありません
          </p>
        )}
        {[...messages].reverse().map((m) => (
          <div
            key={m.id}
            className="rounded-xl border border-[#ede5d8] p-3 shadow-sm"
            style={{ background: "linear-gradient(180deg,#fffaf0,#fdf6e9)" }}
          >
            <div className="flex items-center gap-2">
              <Avatar
                name={m.profiles?.display_name ?? "参加者"}
                url={m.profiles?.avatar_url}
                size={30}
              />
              <span className="flex items-center gap-1 text-[12.5px] font-bold text-[#3a3428]">
                {m.profiles?.display_name ?? "参加者"}
                <VerifiedBadge size={13} />
              </span>
              <span className="ml-auto text-[10px] text-[#a09888]">{fmtTime(m.created_at)}</span>
            </div>
            {m.body && (
              <p className="mt-1.5 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-[#4a4438]">
                {m.body}
              </p>
            )}
            {m.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.image_url}
                alt=""
                className="mt-2 max-h-64 max-w-full rounded-lg object-contain"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

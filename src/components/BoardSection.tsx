"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchBoard,
  fetchBoardSince,
  sendBoardMessage,
  uploadPhoto,
  type BoardMessage,
} from "@/lib/db";
import { Avatar } from "@/components/Avatar";

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * 掲示板（=全員グループTalk）。
 * 初回だけ全件、その後は5秒ポーリングで増分のみ取得（OneSea方式）。
 * document.hidden 中はポーリング停止。
 */
export function BoardSection({
  userId,
  requireJoin,
}: {
  userId: string | null;
  requireJoin: () => void;
}) {
  const [messages, setMessages] = useState<BoardMessage[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetchBoard().then((rows) => {
      if (!alive) return;
      setMessages(rows);
      if (rows.length) cursorRef.current = rows[rows.length - 1].created_at;
    });
    const timer = setInterval(async () => {
      if (document.hidden || !cursorRef.current) return;
      const fresh = await fetchBoardSince(cursorRef.current);
      if (!alive || fresh.length === 0) return;
      cursorRef.current = fresh[fresh.length - 1].created_at;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
      });
    }, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const send = async (imageUrl?: string | null) => {
    if (!userId) {
      requireJoin();
      return;
    }
    const text = body.trim();
    if (!text && !imageUrl) return;
    setBusy(true);
    await sendBoardMessage(userId, text, imageUrl);
    setBody("");
    setBusy(false);
    // 送信直後は即取りに行く
    const fresh = await fetchBoardSince(cursorRef.current ?? "1970-01-01");
    if (fresh.length) {
      cursorRef.current = fresh[fresh.length - 1].created_at;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
      });
    }
    setTimeout(() => bottomRef.current?.scrollIntoView({ block: "nearest" }), 100);
  };

  const pickImage = () => {
    if (!userId) {
      requireJoin();
      return;
    }
    fileRef.current?.click();
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
    <section className="px-4 py-6" id="board">
      <h2 className="text-xl font-bold mb-1">💬 みんなの掲示板</h2>
      <p className="text-sm text-gray-600 mb-4">
        参加者全員で使う連絡板。現地の写真もここへ
      </p>

      <div className="rounded-xl bg-white shadow-sm p-3 max-h-[420px] overflow-y-auto space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500 py-6 text-center">
            まだ書き込みがありません。最初のひとことをどうぞ
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex gap-2">
            <Avatar
              name={m.profiles?.display_name ?? "参加者"}
              url={m.profiles?.avatar_url}
              size={32}
            />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">
                <span className="font-bold text-gray-700">
                  {m.profiles?.display_name ?? "参加者"}
                </span>{" "}
                {fmtTime(m.created_at)}
              </p>
              {m.body && (
                <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
              )}
              {m.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.image_url}
                  alt=""
                  className="mt-1 rounded-lg max-w-full max-h-60 object-contain"
                />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="mt-2 flex gap-2">
        <button
          className="rounded-xl bg-white border border-gray-300 px-3 text-xl"
          onClick={pickImage}
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
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2"
          placeholder={userId ? "メッセージを書く" : "参加すると書き込めます"}
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
          className="rounded-xl bg-[#3a7d44] px-4 text-white font-bold disabled:opacity-50"
          disabled={busy}
          onClick={() => send()}
        >
          送信
        </button>
      </div>
    </section>
  );
}

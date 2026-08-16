"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/useSession";
import {
  deleteBoardMessage,
  fetchBoard,
  fetchBoardSince,
  markGroupRead,
  sendBoardMessage,
  uploadPhoto,
  type BoardMessage,
  type BoardScope,
} from "@/lib/db";
import { Avatar } from "@/components/Avatar";
import { MessageInput } from "@/components/MessageInput";
import { BubbleMenu, useLongPress } from "@/components/BubbleMenu";

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 吹き出し1つ（LINE風: 時刻は吹き出しの外。長押し→削除(自分 or 管理者)/コピー） */
function Bubble({
  m,
  mine,
  canDelete,
  onDelete,
}: {
  m: BoardMessage;
  mine: boolean;
  canDelete: boolean;
  onDelete: (id: string) => void;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const lp = useLongPress((x, y) => setMenu({ x, y }));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(m.body);
    } catch {}
  };
  return (
    <div className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine && (
        <Link href={`/u/${m.user_id}`} className="shrink-0 self-end">
          <Avatar name={m.profiles?.display_name ?? "参加者"} url={m.profiles?.avatar_url} size={28} />
        </Link>
      )}
      <div className={`max-w-[78%] ${mine ? "text-right" : ""}`}>
        {!mine && (
          <p className="mb-0.5 px-1 text-[10px] text-[#a09888]">{m.profiles?.display_name ?? "参加者"}</p>
        )}
        <div className={`flex items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
          {mine && <span className="shrink-0 text-[10px] leading-tight text-[#b8b0a0]">{fmtTime(m.created_at)}</span>}
          <div
            {...lp.handlers}
            className={`inline-block select-none rounded-2xl px-3 py-2 text-left text-[15px] leading-relaxed ${
              mine ? "text-white" : "bg-white shadow-sm"
            } ${menu ? "opacity-70" : ""}`}
            style={{ ...(mine ? { background: "#d96a1a" } : {}), WebkitTouchCallout: "none" } as React.CSSProperties}
          >
            {(m.pref || m.city) && (
              <span
                className={`block text-[11px] font-bold ${mine ? "text-white/90" : ""}`}
                style={mine ? undefined : { color: "#c05e14" }}
              >
                {m.pref ?? ""}{m.city && m.city !== "市は不明" ? ` ${m.city}` : ""}からの投稿
              </span>
            )}
            {m.body && <span className="whitespace-pre-wrap break-words">{m.body}</span>}
            {m.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.image_url} alt="" className="mt-1 max-h-56 max-w-full rounded-lg object-contain" />
            )}
          </div>
          {!mine && <span className="shrink-0 text-[10px] leading-tight text-[#b8b0a0]">{fmtTime(m.created_at)}</span>}
        </div>
      </div>
      {menu && (
        <BubbleMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: "コピー", onClick: copy },
            ...(canDelete ? [{ label: "削除", danger: true, onClick: () => onDelete(m.id) }] : []),
          ]}
        />
      )}
    </div>
  );
}

const META: Record<BoardScope, { name: string; emoji: string; backTo: string }> = {
  voice: { name: "現地からの声", emoji: "📣", backTo: "/voice" },
  board: { name: "みんなの掲示板", emoji: "💬", backTo: "/" },
};

/** グループトーク表示（掲示板と同じデータのTalK風UI。OneSeaのgroup_messages同期方式） */
export default function GroupTalkPage({
  params,
}: {
  params: Promise<{ scope: string }>;
}) {
  const { scope: rawScope } = use(params);
  const scope: BoardScope = rawScope === "voice" ? "voice" : "board";
  const session = useSession();
  const [messages, setMessages] = useState<BoardMessage[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const myId = session.userId;

  useEffect(() => {
    let alive = true;
    fetchBoard(scope).then((rows) => {
      if (!alive) return;
      setMessages(rows);
      if (rows.length) cursorRef.current = rows[rows.length - 1].created_at;
      if (myId) markGroupRead(scope, myId);
      setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
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
      if (myId) markGroupRead(scope, myId);
      setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
    }, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [scope, myId]);

  const pull = async () => {
    const fresh = await fetchBoardSince(scope, cursorRef.current ?? "1970-01-01");
    if (fresh.length) {
      cursorRef.current = fresh[fresh.length - 1].created_at;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
      });
    }
    setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
  };

  const send = async (imageUrl?: string | null) => {
    if (!myId) return;
    const text = body.trim();
    if (!text && !imageUrl) return;
    setBusy(true);
    await sendBoardMessage(scope, myId, text, imageUrl);
    setBody("");
    setBusy(false);
    pull();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !myId) return;
    setBusy(true);
    const url = await uploadPhoto(file, myId);
    setBusy(false);
    if (url) await send(url);
  };

  const remove = async (id: string) => {
    if (!window.confirm("このメッセージを削除しますか？（掲示板からも消えます）")) return;
    const { error } = await deleteBoardMessage(id);
    if (error) {
      window.alert("削除できませんでした");
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const meta = META[scope];

  return (
    <main className="flex h-dvh flex-col" style={{ background: "#faf6ee" }}>
      <header
        className="sticky top-0 flex items-center gap-3 px-4 py-3 text-white"
        style={{ background: "#d96a1a" }}
      >
        <Link href="/talk" className="shrink-0 rounded-full border border-white/60 bg-white/15 px-3 py-1 text-[12.5px] font-bold text-white no-underline" aria-label="戻る">
          戻る
        </Link>
        <span className="text-xl">{meta.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">{meta.name}</p>
          <p className="text-[10px] leading-tight opacity-85">掲示板と同期しています</p>
        </div>
        <Link
          href={meta.backTo}
          className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold text-white no-underline"
        >
          掲示板表示
        </Link>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.map((m) => (
          <Bubble
            key={m.id}
            m={m}
            mine={m.user_id === myId}
            canDelete={!!myId && (m.user_id === myId || session.isAdmin)}
            onDelete={remove}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 border-t border-[#ede5d8] bg-white p-3">
        <button
          className="rounded-xl border border-[#e0d6c6] px-3 text-xl"
          onClick={() => fileRef.current?.click()}
          disabled={busy || !myId}
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
        <MessageInput
          className="border-[#e0d6c6]"
          placeholder={myId ? "メッセージを書く" : "ログインすると書き込めます"}
          value={body}
          onChange={setBody}
          onSend={() => send()}
        />
        <button
          className="rounded-xl px-4 font-bold text-white disabled:opacity-50"
          style={{ background: "#d96a1a" }}
          disabled={busy || !myId}
          onClick={() => send()}
        >
          送信
        </button>
      </div>
    </main>
  );
}

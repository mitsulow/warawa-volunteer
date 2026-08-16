"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/useSession";
import {
  deleteDm,
  fetchChatMeta,
  fetchChatPartner,
  fetchProfile,
  fetchDm,
  fetchDmSince,
  markDmRead,
  sendDm,
  type DmMessage,
  type Profile,
} from "@/lib/db";
import { Avatar } from "@/components/Avatar";
import { MessageInput } from "@/components/MessageInput";
import { Linkify } from "@/components/Linkify";
import { OFFICE_BOT_ID } from "@/lib/config";
import { BubbleMenu, useLongPress } from "@/components/BubbleMenu";

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 吹き出し1つ（LINE風: 既読・時刻は吹き出しの外。長押し→削除(自分のだけ)/コピー） */
function Bubble({
  m,
  mine,
  onDelete,
}: {
  m: DmMessage;
  mine: boolean;
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
    <div className={`flex items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
      {mine && (
        <div className="shrink-0 text-right text-[10px] leading-tight text-gray-400">
          {m.read_at && <div>既読</div>}
          <div>{fmtTime(m.created_at)}</div>
        </div>
      )}
      <div
        {...lp.handlers}
        className={`max-w-[75%] select-none whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[15px] leading-relaxed ${
          mine ? "bg-[#d96a1a] text-white" : "bg-white shadow-sm"
        } ${menu ? "opacity-70" : ""}`}
        style={{ WebkitTouchCallout: "none" } as React.CSSProperties}
      >
        <Linkify text={m.body} className={mine ? "break-all underline text-white" : "break-all underline"} />
      </div>
      {!mine && (
        <div className="shrink-0 text-[10px] leading-tight text-gray-400">{fmtTime(m.created_at)}</div>
      )}
      {menu && (
        <BubbleMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: "コピー", onClick: copy },
            ...(mine ? [{ label: "削除", danger: true, onClick: () => onDelete(m.id) }] : []),
          ]}
        />
      )}
    </div>
  );
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
  // 事務局の受信箱から開いた場合（管理者・自分は参加者でない・事務局ボットのチャット）は「事務局として」読む/書く
  const [actAs, setActAs] = useState<string | null>(null);
  const meId = actAs ?? myId;

  useEffect(() => {
    if (!myId) return;
    let alive = true;
    const timers: ReturnType<typeof setInterval>[] = [];
    (async () => {
      const meta = await fetchChatMeta(chatId);
      if (!alive) return;
      const asOffice =
        !!meta && meta.a !== myId && meta.b !== myId && (meta.a === OFFICE_BOT_ID || meta.b === OFFICE_BOT_ID);
      const me = asOffice ? OFFICE_BOT_ID : myId;
      setActAs(asOffice ? OFFICE_BOT_ID : null);
      if (asOffice && meta) {
        const partnerId = meta.a === OFFICE_BOT_ID ? meta.b : meta.a;
        fetchProfile(partnerId).then((p) => alive && setPartner(p));
      } else {
        fetchChatPartner(chatId, myId).then((p) => alive && setPartner(p));
      }
      const rows = await fetchDm(chatId);
      if (!alive) return;
      setMessages(rows);
      if (rows.length) cursorRef.current = rows[rows.length - 1].created_at;
      markDmRead(chatId, me);
      setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
      const timer = setInterval(async () => {
        if (document.hidden || !cursorRef.current) return;
        const fresh = await fetchDmSince(chatId, cursorRef.current);
        if (!alive || fresh.length === 0) return;
        cursorRef.current = fresh[fresh.length - 1].created_at;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
        });
        markDmRead(chatId, me);
        setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
      }, 5000);
      timers.push(timer);
    })();
    return () => {
      alive = false;
      timers.forEach(clearInterval);
    };
  }, [chatId, myId]);

  const send = async () => {
    if (!meId || !body.trim()) return;
    setBusy(true);
    await sendDm(chatId, meId, body.trim());
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

  const remove = async (id: string) => {
    if (!window.confirm("このメッセージを削除しますか？")) return;
    const { error } = await deleteDm(id);
    if (error) {
      window.alert("削除できませんでした");
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  if (!session.loading && !myId) {
    return (
      <main className="p-6 text-center">
        <p className="mb-4">Talkを使うにはトップページから参加してください。</p>
        <Link href="/" className="text-[#d96a1a] font-bold underline">
          ← トップへ戻る
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col h-dvh">
      <header className="flex items-center gap-3 px-4 py-3 bg-[#d96a1a] text-white sticky top-0">
        <Link href="/talk" className="shrink-0 rounded-full border border-white/60 bg-white/15 px-3 py-1 text-[12.5px] font-bold text-white no-underline" aria-label="戻る">
          戻る
        </Link>
        {partner && (
          <Link href={`/u/${partner.id}`} className="flex min-w-0 items-center gap-2 text-white no-underline active:opacity-80" aria-label="相手のマイページ">
            <Avatar name={partner.display_name} url={partner.avatar_url} size={32} />
            <span className="truncate font-bold">{partner.display_name || "参加者"}</span>
          </Link>
        )}
        {actAs && (
          <span className="ml-auto shrink-0 rounded-full bg-white/25 px-2 py-0.5 text-[10.5px] font-bold">
            事務局として返信
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {messages.map((m) => (
          <Bubble key={m.id} m={m} mine={m.sender_id === meId} onDelete={remove} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 p-3 bg-white border-t border-gray-200">
        <MessageInput
          className="border-gray-300"
          placeholder="メッセージを書く"
          value={body}
          onChange={setBody}
          onSend={send}
        />
        <button
          className="rounded-xl bg-[#d96a1a] px-4 text-white font-bold disabled:opacity-50"
          disabled={busy}
          onClick={send}
        >
          送信
        </button>
      </div>
    </main>
  );
}

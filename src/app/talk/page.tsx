"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/useSession";
import {
  fetchChatList,
  fetchGroupSummaries,
  type BoardScope,
  type ChatSummary,
} from "@/lib/db";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";

function fmtTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const GROUPS: Array<{ scope: BoardScope; name: string; emoji: string; sub: string }> = [
  { scope: "voice", name: "現地からの声", emoji: "📣", sub: "欲しい物・やって欲しい事" },
  { scope: "board", name: "みんなの掲示板", emoji: "💬", sub: "全員の連絡板" },
];

/** TalKタブ: グループトーク（掲示板と同期）2部屋をピン留め + 1対1トーク一覧 */
export default function TalkListPage() {
  const session = useSession();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [groups, setGroups] = useState<Record<
    BoardScope,
    { lastBody: string | null; lastAt: string | null; unread: number }
  > | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session.userId) return;
    let alive = true;
    const load = async () => {
      const [c, g] = await Promise.all([
        fetchChatList(session.userId!),
        fetchGroupSummaries(session.userId!),
      ]);
      if (!alive) return;
      setChats(c);
      setGroups(g);
      setLoaded(true);
    };
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [session.userId]);

  return (
    <main className="min-h-screen pb-24" style={{ background: "#faf6ee" }}>
      <header className="sticky top-0 z-30 border-b border-[#ede5d8] bg-white/95 px-4 py-3 backdrop-blur-sm">
        <h1 className="flex items-center gap-2 text-lg font-bold" style={{ color: "#d96a1a" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-talk-green.webp" alt="" className="h-6 w-6 object-contain" /> TalK
        </h1>
      </header>

      {!session.loading && !session.userId && (
        <div className="p-6 text-center text-sm text-[#8a8070]">
          <p className="mb-3">TalKを使うにはGoogleログインが必要です。</p>
          <Link href="/" className="font-bold underline" style={{ color: "#d96a1a" }}>
            ← ホームから参加する
          </Link>
        </div>
      )}

      {session.userId && (
        <div className="divide-y divide-[#f0e9dc]">
          {/* グループトーク（掲示板/現地からの声と同期） */}
          {GROUPS.map((g) => {
            const s = groups?.[g.scope];
            return (
              <Link
                key={g.scope}
                href={`/talk/g/${g.scope}`}
                className="flex items-center gap-3 bg-[#fffaf0] px-4 py-3 no-underline active:bg-[#f5efe2]"
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                  style={{ background: "linear-gradient(135deg,#fdf0e0,#f5ddb8)", border: "1.5px solid #e8c890" }}
                >
                  {g.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#3a3428]">{g.name}</p>
                  <p className="truncate text-xs text-[#a09888]">{s?.lastBody ?? g.sub}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-[#b8b0a0]">{fmtTime(s?.lastAt ?? null)}</p>
                  {(s?.unread ?? 0) > 0 && (
                    <span className="mt-1 inline-block rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {s!.unread}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}

          {/* 1対1トーク */}
          {chats.map((c) => (
            <Link
              key={c.id}
              href={`/talk/${c.id}`}
              className="flex items-center gap-3 bg-white px-4 py-3 no-underline active:bg-gray-50"
            >
              <Avatar name={c.partnerName} url={c.partnerAvatar} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#3a3428]">{c.partnerName}</p>
                <p className="truncate text-xs text-[#a09888]">
                  {c.lastBody ?? "（まだメッセージがありません）"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] text-[#b8b0a0]">{fmtTime(c.lastAt)}</p>
                {c.unread > 0 && (
                  <span className="mt-1 inline-block rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {c.unread}
                  </span>
                )}
              </div>
            </Link>
          ))}

          {loaded && chats.length === 0 && (
            <p className="px-6 py-6 text-center text-sm text-[#a09888]">
              1対1のTalKはまだありません。
              <br />
              相手のアイコンからマイページを開いて「連絡を取る」で始められます。
            </p>
          )}
        </div>
      )}

      <BottomNav userId={session.userId} active="talk" />
    </main>
  );
}

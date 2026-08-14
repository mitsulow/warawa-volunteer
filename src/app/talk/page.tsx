"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/useSession";
import { fetchChatList, type ChatSummary } from "@/lib/db";
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

/** 自分のTalk一覧タブ。届いたメッセージはここに未読つきで並ぶ */
export default function TalkListPage() {
  const session = useSession();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session.userId) return;
    let alive = true;
    const load = () =>
      fetchChatList(session.userId!).then((rows) => {
        if (!alive) return;
        setChats(rows);
        setLoaded(true);
      });
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
    <main className="pb-20 min-h-screen">
      <header className="bg-[#d96c2c] text-white px-5 py-4 sticky top-0 z-30">
        <h1 className="text-lg font-bold">💬 TalK</h1>
      </header>

      {!session.loading && !session.userId && (
        <div className="p-6 text-center text-sm text-gray-600">
          <p className="mb-3">Talkを使うにはGoogleログインが必要です。</p>
          <Link href="/" className="text-[#d96c2c] font-bold underline">
            ← トップページから参加する
          </Link>
        </div>
      )}

      {session.userId && loaded && chats.length === 0 && (
        <div className="p-6 text-center text-sm text-gray-600">
          まだTalkがありません。
          <br />
          トップの「参加者」から相手を選んで話しかけられます。
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {chats.map((c) => (
          <Link
            key={c.id}
            href={`/talk/${c.id}`}
            className="flex items-center gap-3 px-4 py-3 bg-white active:bg-gray-50"
          >
            <Avatar name={c.partnerName} url={c.partnerAvatar} size={44} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{c.partnerName}</p>
              <p className="text-xs text-gray-500 truncate">
                {c.lastBody ?? "（まだメッセージがありません）"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-gray-400">{fmtTime(c.lastAt)}</p>
              {c.unread > 0 && (
                <span className="inline-block mt-1 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5">
                  {c.unread}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      <BottomNav userId={session.userId} active="talk" />
    </main>
  );
}

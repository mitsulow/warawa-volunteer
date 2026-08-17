"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/useSession";
import {
  fetchBroadcastSummary,
  fetchChatList,
  fetchOfficeInbox,
  fetchGroupSummaries,
  type BoardScope,
  type ChatSummary,
} from "@/lib/db";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";
import { fetchMyGroups, type GroupSummary } from "@/lib/groups";

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
  { scope: "board", name: "みんなの掲示板", emoji: "💬", sub: "全員の連絡板" },
];

/** 1対1トークの1行。未読数はアイコンの右上に赤丸（LINE/OneSea風） */
function ChatRowItem({ c, office = false }: { c: ChatSummary; office?: boolean }) {
  return (
    <Link
      href={`/talk/${c.id}`}
      className={`flex items-center gap-3 px-4 py-3 no-underline active:bg-gray-50 ${office ? "bg-[#fffaf0]" : "bg-white"}`}
    >
      <span className="relative shrink-0">
        <Avatar name={c.partnerName} url={c.partnerAvatar} size={44} />
        {c.unread > 0 && (
          <span
            className="num absolute -right-1 -top-1 flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-white bg-[#e05040] px-1 text-[10px] font-bold text-white"
            style={{ lineHeight: 1 }}
          >
            {c.unread > 99 ? "99+" : c.unread}
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm text-[#3a3428] ${c.unread > 0 ? "font-extrabold" : "font-bold"}`}>{c.partnerName}</p>
        <p className={`truncate text-xs ${c.unread > 0 ? "font-bold text-[#3a3428]" : "text-[#a09888]"}`}>
          {c.lastBody ?? "（まだメッセージがありません）"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[10px] text-[#b8b0a0]">{fmtTime(c.lastAt)}</p>
      </div>
    </Link>
  );
}

/** TalKタブ: グループトーク（掲示板と同期）2部屋をピン留め + 1対1トーク一覧 */
export default function TalkListPage() {
  const session = useSession();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [inbox, setInbox] = useState<ChatSummary[]>([]);
  const [groups, setGroups] = useState<Record<
    BoardScope,
    { lastBody: string | null; lastAt: string | null; unread: number }
  > | null>(null);
  const [bc, setBc] = useState<{ lastBody: string | null; lastAt: string | null; unread: number } | null>(null);
  const [myGroups, setMyGroups] = useState<GroupSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session.userId) return;
    let alive = true;
    const load = async () => {
      const [c, g, b, ib, mg] = await Promise.all([
        fetchChatList(session.userId!),
        fetchGroupSummaries(session.userId!),
        fetchBroadcastSummary(session.userId!).catch(() => null),
        session.isAdmin ? fetchOfficeInbox(session.userId!).catch(() => []) : Promise.resolve([]),
        fetchMyGroups(session.userId!).catch(() => []),
      ]);
      if (!alive) return;
      setChats(c);
      setInbox(ib);
      setGroups(g);
      setBc(b);
      setMyGroups(mg);
      setLoaded(true);
    };
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [session.userId, session.isAdmin]);

  return (
    <main className="min-h-screen pb-24" style={{ background: "#faf6ee" }}>
      <header className="sticky top-0 z-30 border-b border-[#ede5d8] bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="relative flex items-center justify-center">
          <Link
            href="/"
            className="absolute left-0 rounded-full border px-3 py-1 text-[12.5px] font-bold no-underline"
            style={{ color: "#d96a1a", borderColor: "#f0d0a8", background: "#fff" }}
          >
            戻る
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-bold" style={{ color: "#d96a1a" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-talk-green.webp" alt="" className="h-6 w-6 object-contain" /> TalK
          </h1>
        </div>
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
          {/* 📢 事務局からのお知らせ（全員に届く一斉配信・ピン留め） */}
          <Link
            href="/talk/broadcast"
            className="flex items-center gap-3 px-4 py-3 no-underline active:bg-[#f5efe2]"
            style={{ background: "#fdf0e0" }}
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
              style={{ background: "linear-gradient(120deg,#d96a1a,#a84e0e)" }}
            >
              📢
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#3a3428]">事務局からのお知らせ</p>
              <p className="truncate text-xs text-[#a09888]">
                {bc?.lastBody ?? "全員に届く一斉配信"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] text-[#b8b0a0]">{fmtTime(bc?.lastAt ?? null)}</p>
              {(bc?.unread ?? 0) > 0 && (
                <span className="mt-1 inline-block rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {bc!.unread}
                </span>
              )}
            </div>
          </Link>

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

          {/* グループTalK（LINEグループ相当・招待されたものだけ）。未読はアイコン右上の赤丸 */}
          {myGroups.map((g) => (
            <Link key={g.id} href={`/talk/group/${g.id}`} className="flex items-center gap-3 bg-white px-4 py-3 no-underline active:bg-gray-50">
              <span className="relative shrink-0">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full text-xl"
                  style={{ background: "linear-gradient(135deg,#e6f0ff,#c8dcf5)", border: "1.5px solid #9dbbe0" }}
                >
                  {g.kind === "schedule" ? "📅" : "👥"}
                </span>
                {g.unread > 0 && (
                  <span
                    className="num absolute -right-1 -top-1 flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-white bg-[#e05040] px-1 text-[10px] font-bold text-white"
                    style={{ lineHeight: 1 }}
                  >
                    {g.unread > 99 ? "99+" : g.unread}
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm text-[#3a3428] ${g.unread > 0 ? "font-extrabold" : "font-bold"}`}>
                  {g.name} <span className="num text-[11px] font-normal text-[#a09888]">({g.memberCount})</span>
                </p>
                <p className={`truncate text-xs ${g.unread > 0 ? "font-bold text-[#3a3428]" : "text-[#a09888]"}`}>{g.lastBody ?? "（まだメッセージがありません）"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] text-[#b8b0a0]">{fmtTime(g.lastAt)}</p>
              </div>
            </Link>
          ))}

          {/* 1対1トーク（未読数はアイコンの右上に赤丸） */}
          {chats.map((c) => (
            <ChatRowItem key={c.id} c={c} />
          ))}

          {/* 事務局の受信箱（管理者だけ）: 事務局ボット宛のTalK。開くと事務局として返信できる */}
          {session.isAdmin && inbox.length > 0 && (
            <>
              <div className="flex items-center gap-2 bg-[#fdf0e0] px-4 py-1.5 text-[11.5px] font-extrabold" style={{ color: "#c05e14" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/office-avatar.png" alt="" className="h-5 w-5 rounded-full" />
                事務局の受信箱（管理者のみ・事務局として返信）
                {inbox.reduce((n, c) => n + c.unread, 0) > 0 && (
                  <span className="num ml-auto rounded-full bg-[#e05040] px-1.5 py-0.5 text-[10px] text-white">
                    {inbox.reduce((n, c) => n + c.unread, 0)}
                  </span>
                )}
              </div>
              {inbox.map((c) => (
                <ChatRowItem key={c.id} c={c} office />
              ))}
            </>
          )}

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

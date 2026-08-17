"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useSession } from "@/lib/useSession";
import {
  deleteGroupMessage,
  fetchGroup,
  fetchGroupMembers,
  fetchGroupMessages,
  fetchGroupMessagesSince,
  leaveGroup,
  markGroupTalkRead,
  sendGroupMessage,
  type Group,
  type GroupMember,
  type GroupMessage,
} from "@/lib/groups";
import { fetchAnswers, fetchSchedule, type Schedule, type ScheduleAnswer } from "@/lib/schedule";
import { Avatar } from "@/components/Avatar";
import { MessageInput } from "@/components/MessageInput";
import { Linkify } from "@/components/Linkify";
import { BubbleMenu, useLongPress } from "@/components/BubbleMenu";

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtDay(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  if (d.toDateString() === t.toDateString()) return "今日";
  return `${d.getMonth() + 1}/${d.getDate()}(${"日月火水木金土"[d.getDay()]})`;
}

/** LINEグループ風の吹き出し。他人は左にアイコン+名前、自分は右。長押しでコピー/削除(自分 or 管理者) */
function Bubble({ m, mine, canDelete, onDelete }: { m: GroupMessage; mine: boolean; canDelete: boolean; onDelete: (id: string) => void }) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const lp = useLongPress((x, y) => setMenu({ x, y }));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(m.body);
    } catch {}
  };
  if (m.system) {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-[#e8e0d0] px-3 py-1 text-[11px] text-[#6a6050]">{m.body}</span>
      </div>
    );
  }
  const name = m.profiles?.display_name || "参加者";
  return (
    <div className={`flex items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine && (
        <Link href={m.sender_id ? `/u/${m.sender_id}` : "#"} className="mb-4 shrink-0 no-underline">
          <Avatar name={name} url={m.profiles?.avatar_url ?? null} size={32} />
        </Link>
      )}
      {mine && <div className="shrink-0 text-right text-[10px] leading-tight text-gray-400">{fmtTime(m.created_at)}</div>}
      <div className={`flex max-w-[75%] flex-col ${mine ? "items-end" : "items-start"}`}>
        {!mine && <span className="mb-0.5 ml-1 text-[10.5px] text-[#8a8070]">{name}</span>}
        <div
          {...lp.handlers}
          className={`select-none whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[15px] leading-relaxed ${
            mine ? "bg-[#d96a1a] text-white" : "bg-white shadow-sm"
          } ${menu ? "opacity-70" : ""}`}
          style={{ WebkitTouchCallout: "none" } as React.CSSProperties}
        >
          {m.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.image_url} alt="" className="mb-1 max-h-64 rounded-lg" />
          )}
          <Linkify text={m.body} className={mine ? "break-all underline text-white" : "break-all underline"} />
        </div>
      </div>
      {!mine && <div className="shrink-0 text-[10px] leading-tight text-gray-400">{fmtTime(m.created_at)}</div>}
      {menu && (
        <BubbleMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[{ label: "コピー", onClick: copy }, ...(canDelete ? [{ label: "削除", danger: true, onClick: () => onDelete(m.id) }] : [])]}
        />
      )}
    </div>
  );
}

/** 日程調整グループだけ: トップに固定される調整くんカード（集計の要約+回答ボタン） */
function PinnedSchedule({ scheduleId, groupId, myId }: { scheduleId: string; groupId: string; myId: string | null }) {
  const [sched, setSched] = useState<Schedule | null>(null);
  const [answers, setAnswers] = useState<ScheduleAnswer[]>([]);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [s, a] = await Promise.all([fetchSchedule(scheduleId), fetchAnswers(scheduleId)]);
      if (!alive) return;
      setSched(s);
      setAnswers(a);
    };
    load();
    const t = setInterval(() => !document.hidden && load(), 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [scheduleId]);
  const counts = useMemo(() => {
    const c: Array<{ o: number; d: number; x: number }> = (sched?.slots ?? []).map(() => ({ o: 0, d: 0, x: 0 }));
    for (const a of answers) for (const [k, v] of Object.entries(a.answers ?? {})) if (c[Number(k)] && (v === "o" || v === "d" || v === "x")) c[Number(k)][v]++;
    return c;
  }, [answers, sched]);
  const ranked = useMemo(
    () =>
      counts
        .map((c, i) => ({ i, c, score: c.o * 2 + c.d }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3),
    [counts]
  );
  if (!sched) return null;
  const mine = myId ? answers.find((a) => a.user_id === myId) : null;
  const href = `/schedule/${scheduleId}?back=${encodeURIComponent(`/talk/group/${groupId}`)}`;
  return (
    <div className="sticky top-0 z-20 border-b border-[#f0d0a8] bg-[#fff8ec] px-3 py-2 shadow-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 text-left">
        <span className="text-base">📌</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-[#c05e14]">📅 {sched.title}</span>
        <span className="shrink-0 text-[10.5px] text-[#a09888]">
          回答 {answers.length}人 {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div className="mt-1.5">
          {sched.closed ? (
            <p className="text-[12px] font-bold text-[#8a8070]">この日程調整は締め切りました</p>
          ) : (
            <>
              {ranked.length > 0 && answers.length > 0 && (
                <ul className="mb-1.5 space-y-0.5">
                  {ranked.map(({ i, c }, rank) => (
                    <li key={i} className="flex items-center gap-2 text-[12px] text-[#3a3428]">
                      <span className={`num shrink-0 rounded-full px-1.5 text-[10px] font-bold text-white ${rank === 0 ? "bg-[#2e7d4f]" : "bg-[#b8b0a0]"}`}>{rank === 0 ? "最有力" : `${rank + 1}位`}</span>
                      <span className="min-w-0 flex-1 truncate font-bold">{sched.slots[i]}</span>
                      <span className="num shrink-0 text-[11px] text-[#8a8070]">
                        ○{c.o} △{c.d} ×{c.x}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={href}
                className="block rounded-xl py-2 text-center text-[13.5px] font-extrabold text-white no-underline"
                style={{ background: mine ? "#8a8070" : "#d96a1a" }}
              >
                {mine ? "○△× を見る・変更する" : "○△× を回答する（1分）"}
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** メンバー一覧（portalで全面） */
function MembersSheet({ members, onClose }: { members: GroupMember[]; onClose: () => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/40" onClick={onClose}>
      <div className="mt-auto max-h-[75dvh] overflow-y-auto rounded-t-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[14px] font-extrabold text-[#3a3428]">メンバー（{members.length}人）</p>
          <button type="button" onClick={onClose} className="rounded-full border px-3 py-1 text-[12px] font-bold" style={{ color: "#d96a1a", borderColor: "#f0d0a8" }}>
            閉じる
          </button>
        </div>
        <ul className="divide-y divide-[#f0e9dc]">
          {members.map((m) => (
            <li key={m.user_id}>
              <Link href={`/u/${m.user_id}`} className="flex items-center gap-3 py-2 no-underline">
                <Avatar name={m.profiles?.display_name ?? "参加者"} url={m.profiles?.avatar_url ?? null} size={36} />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-[#3a3428]">{m.profiles?.display_name ?? "参加者"}</span>
                {m.profiles?.member_no != null && <span className="num text-[11px] text-[#a09888]">No.{m.profiles.member_no}</span>}
                {m.role === "owner" && <span className="rounded-full bg-[#fdf0e0] px-1.5 text-[10px] font-bold text-[#c05e14]">事務局</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  );
}

/** グループTalK（LINEグループ相当）。12秒ポーリング・増分取得 */
export default function GroupTalkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const session = useSession();
  const myId = session.userId;
  const [group, setGroup] = useState<Group | null | undefined>(undefined);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!myId) return;
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    (async () => {
      const [g, ms, rows] = await Promise.all([fetchGroup(id), fetchGroupMembers(id), fetchGroupMessages(id)]);
      if (!alive) return;
      setGroup(g);
      setMembers(ms);
      setMessages(rows);
      if (rows.length) cursorRef.current = rows[rows.length - 1].created_at;
      markGroupTalkRead(id, myId);
      setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
      timer = setInterval(async () => {
        if (document.hidden || !cursorRef.current) return;
        const fresh = await fetchGroupMessagesSince(id, cursorRef.current);
        if (!alive || fresh.length === 0) return;
        cursorRef.current = fresh[fresh.length - 1].created_at;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
        });
        markGroupTalkRead(id, myId);
        setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
      }, 12000);
    })();
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [id, myId]);

  const send = async () => {
    if (!myId || !body.trim()) return;
    setBusy(true);
    const { error } = await sendGroupMessage(id, myId, body.trim());
    setBusy(false);
    if (error) {
      window.alert("送信できませんでした");
      return;
    }
    setBody("");
    const fresh = await fetchGroupMessagesSince(id, cursorRef.current ?? "1970-01-01");
    if (fresh.length) {
      cursorRef.current = fresh[fresh.length - 1].created_at;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
      });
    }
    setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
  };

  const remove = async (mid: string) => {
    if (!window.confirm("このメッセージを削除しますか？")) return;
    const { error } = await deleteGroupMessage(mid);
    if (error) {
      window.alert("削除できませんでした");
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== mid));
  };

  const leave = async () => {
    if (!myId || !window.confirm("このグループから退出しますか？")) return;
    await leaveGroup(id, myId);
    window.location.href = "/talk";
  };

  if (!session.loading && !myId) {
    return (
      <main className="p-6 text-center">
        <p className="mb-4">TalKを使うにはトップページから参加してください。</p>
        <Link href="/" className="font-bold underline text-[#d96a1a]">
          ← トップへ戻る
        </Link>
      </main>
    );
  }
  if (group === null) {
    return (
      <main className="p-6 text-center text-sm text-[#a09888]">
        <p className="mb-4">このグループは見つからないか、メンバーではありません。</p>
        <Link href="/talk" className="font-bold underline text-[#d96a1a]">
          ← TalKへ戻る
        </Link>
      </main>
    );
  }

  // 日付の区切り
  let lastDay = "";

  return (
    <main className="flex h-dvh flex-col" style={{ background: "#f3efe6" }}>
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-[#d96a1a] px-3 py-3 text-white">
        <Link href="/talk" className="shrink-0 rounded-full border border-white/60 bg-white/15 px-3 py-1 text-[12.5px] font-bold text-white no-underline" aria-label="戻る">
          戻る
        </Link>
        <button type="button" onClick={() => setShowMembers(true)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-white">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-base">{group?.kind === "schedule" ? "📅" : "👥"}</span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-bold leading-tight">{group?.name ?? "…"}</span>
            <span className="block text-[10.5px] leading-tight text-white/85">{members.length}人 ・ タップでメンバー</span>
          </span>
        </button>
        {group && group.kind !== "schedule" && (
          <button type="button" onClick={leave} className="shrink-0 rounded-full bg-white/15 px-2 py-1 text-[10.5px] font-bold text-white">
            退出
          </button>
        )}
      </header>

      {group?.kind === "schedule" && group.schedule_id && <PinnedSchedule scheduleId={group.schedule_id} groupId={id} myId={myId ?? null} />}

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {group?.description && (
          <p className="mx-auto max-w-[90%] whitespace-pre-wrap rounded-xl bg-[#e8e0d0] px-3 py-2 text-center text-[11.5px] text-[#6a6050]">{group.description}</p>
        )}
        {messages.map((m) => {
          const day = fmtDay(m.created_at);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id} className="space-y-2">
              {showDay && (
                <div className="flex justify-center">
                  <span className="rounded-full bg-[#ddd5c4] px-2.5 py-0.5 text-[10px] font-bold text-[#6a6050]">{day}</span>
                </div>
              )}
              <Bubble m={m} mine={m.sender_id === myId} canDelete={m.sender_id === myId || !!session.isAdmin} onDelete={remove} />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 border-t border-gray-200 bg-white p-3">
        <MessageInput className="border-gray-300" placeholder="みんなにメッセージ" value={body} onChange={setBody} onSend={send} />
        <button className="rounded-xl bg-[#d96a1a] px-4 font-bold text-white disabled:opacity-50" disabled={busy} onClick={send}>
          送信
        </button>
      </div>

      {showMembers && <MembersSheet members={members} onClose={() => setShowMembers(false)} />}
    </main>
  );
}

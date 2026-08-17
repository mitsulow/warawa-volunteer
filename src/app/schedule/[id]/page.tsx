"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/useSession";
import { fetchAnswers, fetchSchedule, saveAnswer, setScheduleClosed, type Mark, type Schedule, type ScheduleAnswer } from "@/lib/schedule";
import { createClient } from "@/lib/supabase";
import { Avatar } from "@/components/Avatar";
import { JoinDialog } from "@/components/JoinDialog";

/* eslint-disable @next/next/no-img-element */

const MARK: Record<Mark, { label: string; color: string; bg: string }> = {
  o: { label: "○", color: "#2e7d4f", bg: "#e6f4ea" },
  d: { label: "△", color: "#b8860b", bg: "#fff6d6" },
  x: { label: "×", color: "#c0392b", bg: "#fdecea" },
};

/** 調整さん風: 候補日時 × 参加者 の ○△× 表。ログインした人は自分の行を編集できる */
export default function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const session = useSession();
  const [sched, setSched] = useState<Schedule | null | undefined>(undefined);
  const [answers, setAnswers] = useState<ScheduleAnswer[]>([]);
  const [mine, setMine] = useState<Record<string, Mark>>({});
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [sending, setSending] = useState(false);
  // グループTalKから開いた時は ?back=/talk/group/<id> で戻り先を受け取る（サイト内パスのみ）
  const [backHref, setBackHref] = useState("/");
  useEffect(() => {
    const b = new URLSearchParams(window.location.search).get("back");
    if (b && b.startsWith("/") && !b.startsWith("//")) setBackHref(b);
  }, []);

  const load = async () => {
    const [s, a] = await Promise.all([fetchSchedule(id), fetchAnswers(id)]);
    setSched(s);
    setAnswers(a);
    if (session.userId) {
      const m = a.find((x) => x.user_id === session.userId);
      if (m) {
        setMine(m.answers ?? {});
        setComment(m.comment ?? "");
      }
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, session.userId]);

  const counts = useMemo(() => {
    const c: Record<number, { o: number; d: number; x: number }> = {};
    (sched?.slots ?? []).forEach((_, i) => (c[i] = { o: 0, d: 0, x: 0 }));
    for (const a of answers) for (const [k, v] of Object.entries(a.answers ?? {})) if (c[Number(k)] && (v === "o" || v === "d" || v === "x")) c[Number(k)][v]++;
    return c;
  }, [answers, sched]);
  const best = useMemo(() => {
    let bi = -1, bs = -1;
    Object.entries(counts).forEach(([i, c]) => {
      const s = c.o * 2 + c.d;
      if (s > bs) { bs = s; bi = Number(i); }
    });
    return bi;
  }, [counts]);

  const save = async () => {
    if (!session.userId) { setShowJoin(true); return; }
    setSaving(true);
    const { error } = await saveAnswer(id, session.userId, mine, comment);
    setSaving(false);
    if (error) { window.alert("保存できませんでした"); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load();
  };

  const invite = async () => {
    if (!window.confirm("現地入りに立候補している全員へ、事務局アカウントからこの日程調整のTalKを送りますか？（未回答の人だけに送ります）")) return;
    setSending(true);
    const { data: { session: s } } = await createClient().auth.getSession();
    const res = await fetch("/api/schedule-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${s?.access_token ?? ""}` },
      body: JSON.stringify({ scheduleId: id }),
    });
    setSending(false);
    const j = await res.json().catch(() => ({}));
    window.alert(res.ok ? `${j.sent ?? 0}人に送りました` : `送れませんでした: ${j.error ?? res.status}`);
  };

  if (sched === undefined) return <main className="p-6 text-center text-sm text-[#a09888]">読み込み中…</main>;
  if (!sched) return <main className="p-6 text-center text-sm text-[#a09888]">この日程調整は見つかりませんでした</main>;

  return (
    <main className="min-h-screen pb-24" style={{ background: "#faf6ee" }}>
      <header className="sticky top-0 z-30 border-b border-[#ede5d8] bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="relative flex items-center justify-center">
          <Link href={backHref} className="absolute left-0 rounded-full border px-3 py-1 text-[12.5px] font-bold no-underline" style={{ color: "#d96a1a", borderColor: "#f0d0a8", background: "#fff" }}>戻る</Link>
          <span className="text-[14px] font-bold text-[#1c1e21]">📅 日程調整</span>
        </div>
      </header>

      <div className="px-4 pt-4">
        <h1 className="text-[18px] font-extrabold text-[#3a3428]">{sched.title}</h1>
        {sched.description && <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[#5a5448]">{sched.description}</p>}
        {sched.closed && <p className="mt-2 rounded-lg bg-[#f0ece2] px-3 py-1.5 text-[12px] font-bold text-[#8a8070]">受付を終了しました</p>}

        {!session.loading && !session.userId && (
          <div className="mt-3 rounded-xl border border-dashed border-[#e0d6c6] bg-white p-3 text-center text-[13px] text-[#8a8070]">
            回答するにはGoogleログインが必要です
            <button onClick={() => setShowJoin(true)} className="mt-2 block w-full rounded-full py-2 text-[13px] font-bold text-white" style={{ background: "#d96a1a" }}>参加（ログイン）</button>
          </div>
        )}

        {/* 自分の回答 */}
        {session.userId && !sched.closed && (
          <div className="mt-3 rounded-2xl border border-[#ede5d8] bg-white p-3 shadow-sm">
            <p className="text-[13px] font-extrabold text-[#3a3428]">あなたの都合を選んでください</p>
            <p className="text-[11px] text-[#a09888]">○=参加できる／△=調整すれば可／×=不可</p>
            <div className="mt-2 divide-y divide-[#f0ece0]">
              {sched.slots.map((slot, i) => (
                <div key={i} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 text-[14px] font-bold text-[#3a3428]">{slot}</span>
                  {(["o", "d", "x"] as Mark[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMine((p) => ({ ...p, [i]: m }))}
                      className="h-9 w-9 rounded-full border text-[15px] font-extrabold"
                      style={mine[i] === m ? { background: MARK[m].color, color: "#fff", borderColor: MARK[m].color } : { background: "#fff", color: MARK[m].color, borderColor: "#e8dcc4" }}
                      aria-label={MARK[m].label}
                    >
                      {MARK[m].label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={200}
              placeholder="ひとこと（任意）例：18日は19時以降なら可"
              className="mt-2 w-full rounded-xl border px-3 py-2 text-[13px] outline-none focus:border-[#d96a1a]"
              style={{ borderColor: "#e8dcc4" }}
            />
            <button
              onClick={save}
              disabled={saving || Object.keys(mine).length === 0}
              className="mt-2 w-full rounded-xl py-3 text-[14px] font-extrabold text-white disabled:opacity-40"
              style={{ background: "#d96a1a" }}
            >
              {saving ? "保存中…" : saved ? "✅ 保存しました" : "この内容で回答する"}
            </button>
          </div>
        )}

        {/* 集計表 */}
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[#ede5d8] bg-white shadow-sm">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-[#fdeedd] text-[#5a5448]">
                <th className="sticky left-0 z-10 bg-[#fdeedd] px-2 py-2 text-left">候補</th>
                <th className="px-1 py-2 text-center" style={{ color: MARK.o.color }}>○</th>
                <th className="px-1 py-2 text-center" style={{ color: MARK.d.color }}>△</th>
                <th className="px-1 py-2 text-center" style={{ color: MARK.x.color }}>×</th>
                {answers.map((a) => (
                  <th key={a.id} className="px-1 py-1 text-center font-normal">
                    <Link href={`/u/${a.user_id}`} className="inline-flex flex-col items-center no-underline">
                      <Avatar name={a.profiles?.display_name ?? "参加者"} url={a.profiles?.avatar_url} size={26} />
                      <span className="mt-0.5 max-w-[56px] truncate text-[9.5px] text-[#5a5448]">{a.profiles?.display_name ?? "参加者"}</span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sched.slots.map((slot, i) => (
                <tr key={i} className="border-t border-[#f0ece0]" style={i === best && answers.length > 0 ? { background: "#f4faf6" } : undefined}>
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-2 font-bold text-[#3a3428]" style={i === best && answers.length > 0 ? { background: "#f4faf6" } : undefined}>
                    {slot}
                    {i === best && answers.length > 0 && <span className="ml-1 rounded-full px-1.5 text-[9.5px] font-bold text-white" style={{ background: "#2e7d4f" }}>最有力</span>}
                  </td>
                  <td className="num px-1 py-2 text-center font-bold" style={{ color: MARK.o.color }}>{counts[i]?.o ?? 0}</td>
                  <td className="num px-1 py-2 text-center font-bold" style={{ color: MARK.d.color }}>{counts[i]?.d ?? 0}</td>
                  <td className="num px-1 py-2 text-center font-bold" style={{ color: MARK.x.color }}>{counts[i]?.x ?? 0}</td>
                  {answers.map((a) => {
                    const m = a.answers?.[String(i)];
                    return (
                      <td key={a.id} className="px-1 py-2 text-center">
                        {m ? (
                          <span className="inline-block h-6 w-6 rounded-full text-[13px] font-extrabold leading-6" style={{ background: MARK[m].bg, color: MARK[m].color }}>{MARK[m].label}</span>
                        ) : (
                          <span className="text-[#d0c8b8]">–</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {answers.some((a) => a.comment) && (
                <tr className="border-t border-[#f0ece0]">
                  <td className="sticky left-0 z-10 bg-white px-2 py-2 text-[11px] font-bold text-[#8a8070]">ひとこと</td>
                  <td colSpan={3} />
                  {answers.map((a) => (
                    <td key={a.id} className="max-w-[90px] px-1 py-2 align-top text-[10.5px] leading-snug text-[#5a5448]">{a.comment ?? ""}</td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-[#a09888]">回答 {answers.length} 人。表は横にスクロールできます。</p>

        {/* 事務局 */}
        {session.isAdmin && (
          <div className="mt-4 rounded-2xl border border-[#f0d0a8] bg-[#fffaf0] p-3">
            <p className="text-[12.5px] font-extrabold text-[#c05e14]">事務局メニュー</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={invite} disabled={sending} className="rounded-full px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50" style={{ background: "#d96a1a" }}>
                {sending ? "送信中…" : "🏃 現地入り立候補者へTalKで送る（未回答者のみ）"}
              </button>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(`${window.location.origin}/schedule/${id}`);
                  window.alert("リンクをコピーしました");
                }}
                className="rounded-full border px-3 py-1.5 text-[12px] font-bold"
                style={{ borderColor: "#d96a1a", color: "#d96a1a", background: "#fff" }}
              >
                🔗 リンクをコピー
              </button>
              <button
                onClick={async () => {
                  await setScheduleClosed(id, !sched.closed);
                  load();
                }}
                className="rounded-full border px-3 py-1.5 text-[12px] font-bold text-[#8a7a5a]"
                style={{ borderColor: "#e8dcc4", background: "#fff" }}
              >
                {sched.closed ? "受付を再開する" : "受付を終了する"}
              </button>
            </div>
          </div>
        )}
      </div>
      {showJoin && <JoinDialog onClose={() => setShowJoin(false)} />}
    </main>
  );
}

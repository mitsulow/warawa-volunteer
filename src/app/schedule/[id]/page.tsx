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

const nextMark = (m: Mark | undefined): Mark => (m === "o" ? "d" : m === "d" ? "x" : "o");

/** 調整さん風: 縦=候補日時 × 横=参加者 の ○△× 表。自分の列をタップして回答（○→△→×）。○が多い行ほど緑が濃く、最有力に👑 */
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
  // 自分の回答は左端の「あなた」列に出すので他の列からは外す（締切後は編集列が無いので全員そのまま）
  const others = useMemo(() => (sched?.closed ? answers : answers.filter((a) => a.user_id !== session.userId)), [answers, session.userId, sched?.closed]);
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

        {/* 一枚の表: 縦=候補日時 / 横=参加者。○が多い行ほど緑が濃く、最有力に👑。自分の列(左端・オレンジ)はタップで ○→△→× と切り替え */}
        {session.userId && !sched.closed && (
          <p className="mt-3 text-[12px] font-bold text-[#c05e14]">
            👉 オレンジの「あなた」の列をタップして ○△× を付けてください（タップするたびに ○→△→× と変わります）
          </p>
        )}
        <div className="mt-2 overflow-x-auto rounded-2xl border border-[#ede5d8] bg-white shadow-sm">
          <table className="border-separate border-spacing-0 text-[12.5px]" style={{ minWidth: "100%" }}>
            <thead>
              <tr className="bg-[#fdeedd] text-[#5a5448]">
                <th className="sticky left-0 z-20 whitespace-nowrap bg-[#fdeedd] px-2 py-2 text-left text-[11.5px]">候補日時</th>
                <th className="whitespace-nowrap px-1.5 py-2 text-center text-[11px]" style={{ color: MARK.o.color }}>○の人数</th>
                {session.userId && !sched.closed && (
                  <th className="px-1 py-1 text-center" style={{ background: "#fff1e0" }}>
                    <span className="inline-flex flex-col items-center">
                      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[12px] font-extrabold text-white" style={{ background: "#d96a1a" }}>私</span>
                      <span className="mt-0.5 text-[9.5px] font-extrabold" style={{ color: "#c05e14" }}>あなた</span>
                    </span>
                  </th>
                )}
                {others.map((a) => (
                  <th key={a.id} className="px-1 py-1 text-center font-normal">
                    <Link href={`/u/${a.user_id}`} className="inline-flex flex-col items-center no-underline">
                      <Avatar name={a.profiles?.display_name ?? "参加者"} url={a.profiles?.avatar_url} size={26} />
                      <span className="mt-0.5 max-w-[52px] truncate text-[9.5px] text-[#5a5448]">{a.profiles?.display_name ?? "参加者"}</span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sched.slots.map((slot, i) => {
                const c = counts[i] ?? { o: 0, d: 0, x: 0 };
                const total = answers.length || 1;
                const ratio = c.o / total;
                // ○が多いほど濃い緑（0→白, 全員○→しっかり緑）
                const rowBg = c.o > 0 ? `rgba(46,125,79,${(0.06 + ratio * 0.22).toFixed(3)})` : "#fff";
                const isBest = i === best && answers.length > 0 && c.o > 0;
                const myMark = mine[i];
                return (
                  <tr key={i}>
                    <td className="sticky left-0 z-10 whitespace-nowrap border-t border-[#f0ece0] px-1.5 py-1.5 font-bold leading-tight text-[#3a3428]" style={{ background: rowBg === "#fff" ? "#fff" : `linear-gradient(${rowBg},${rowBg}), #fff` }}>
                      {/* 左ますは細く: 1行目=日付 / 2行目=時刻 / 最有力は3行目に */}
                      {(() => {
                        const sp = slot.match(/^(\S+)\s+(.+)$/);
                        return sp ? (
                          <>
                            <span className="block text-[11px] text-[#6a6050]">{sp[1]}</span>
                            <span className="block text-[13px]">{sp[2]}</span>
                          </>
                        ) : (
                          <span className="block text-[12.5px]">{slot}</span>
                        );
                      })()}
                      {isBest && <span className="mt-0.5 inline-block rounded-full px-1.5 text-[9.5px] font-bold text-white" style={{ background: "#2e7d4f" }}>👑最有力</span>}
                    </td>
                    <td className="border-t border-[#f0ece0] px-1.5 py-2 text-center" style={{ background: rowBg }}>
                      <span className="num inline-block min-w-[34px] rounded-full px-1.5 text-[12px] font-extrabold" style={{ background: c.o > 0 ? "#2e7d4f" : "#e8e0d0", color: c.o > 0 ? "#fff" : "#a09888" }}>
                        {c.o}人
                      </span>
                      {(c.d > 0 || c.x > 0) && (
                        <span className="num mt-0.5 block text-[9.5px] text-[#8a8070]">
                          △{c.d} ×{c.x}
                        </span>
                      )}
                    </td>
                    {session.userId && !sched.closed && (
                      <td className="border-t border-[#f0ece0] px-1 py-1 text-center" style={{ background: "#fff1e0" }}>
                        <button
                          type="button"
                          onClick={() => setMine((p) => ({ ...p, [i]: nextMark(p[i]) }))}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 text-[16px] font-extrabold"
                          style={myMark ? { background: MARK[myMark].color, color: "#fff", borderColor: MARK[myMark].color } : { background: "#fff", color: "#c8b8a0", borderColor: "#e8c9a0", borderStyle: "dashed" }}
                          aria-label={myMark ? MARK[myMark].label : "未回答"}
                        >
                          {myMark ? MARK[myMark].label : "?"}
                        </button>
                      </td>
                    )}
                    {others.map((a) => {
                      const m = a.answers?.[String(i)];
                      return (
                        <td key={a.id} className="border-t border-[#f0ece0] px-0.5 py-1 text-center" style={{ background: m ? MARK[m].bg : rowBg }}>
                          {m ? (
                            <span className="inline-block h-7 w-7 rounded-full text-[14px] font-extrabold leading-7" style={{ background: m === "o" ? MARK.o.color : "transparent", color: m === "o" ? "#fff" : MARK[m].color }}>{MARK[m].label}</span>
                          ) : (
                            <span className="text-[#d0c8b8]">–</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {(others.some((a) => a.comment) || comment) && (
                <tr>
                  <td className="sticky left-0 z-10 border-t border-[#f0ece0] bg-white px-2 py-2 text-[11px] font-bold text-[#8a8070]">ひとこと</td>
                  <td className="border-t border-[#f0ece0]" />
                  {session.userId && !sched.closed && <td className="max-w-[90px] border-t border-[#f0ece0] px-1 py-2 align-top text-[10.5px] leading-snug text-[#5a5448]" style={{ background: "#fff1e0" }}>{comment}</td>}
                  {others.map((a) => (
                    <td key={a.id} className="max-w-[90px] border-t border-[#f0ece0] px-1 py-2 align-top text-[10.5px] leading-snug text-[#5a5448]">{a.comment ?? ""}</td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#a09888]">
          <span>回答 {answers.length} 人</span>
          <span><span className="inline-block h-3 w-3 rounded-full align-middle" style={{ background: MARK.o.color }} /> ○ 参加できる</span>
          <span><span className="inline-block align-middle font-extrabold" style={{ color: MARK.d.color }}>△</span> 調整すれば可</span>
          <span><span className="inline-block align-middle font-extrabold" style={{ color: MARK.x.color }}>×</span> 不可</span>
          <span>横にスクロールできます</span>
        </div>

        {/* 自分の回答の保存（ひとこと＋ボタン） */}
        {session.userId && !sched.closed && (
          <div className="mt-3 rounded-2xl border border-[#f0d0a8] bg-[#fffaf0] p-3 shadow-sm">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={200}
              placeholder="ひとこと（任意）例：18日は19時以降なら可"
              className="w-full rounded-xl border bg-white px-3 py-2 text-[13px] outline-none focus:border-[#d96a1a]"
              style={{ borderColor: "#e8dcc4" }}
            />
            <button
              onClick={save}
              disabled={saving || Object.keys(mine).length === 0}
              className="mt-2 w-full rounded-xl py-3 text-[14px] font-extrabold text-white disabled:opacity-40"
              style={{ background: "#d96a1a" }}
            >
              {saving ? "保存中…" : saved ? "✅ 保存しました" : Object.keys(mine).length === 0 ? "表の「あなた」の列をタップして○△×を付けてください" : `この内容で回答する（${Object.keys(mine).length}/${sched.slots.length}件）`}
            </button>
          </div>
        )}

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

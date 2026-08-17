"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { addGroupMembers, createGroup, fetchAllGroups, type Group } from "@/lib/groups";
import type { Schedule } from "@/lib/schedule";
import { OFFICE_BOT_ID } from "@/lib/config";

/** 事務局: グループTalKの作成・招待（現地入り立候補者を全員招待 / 管理者を招待 / わらわ〜番号で招待） */
export function GroupAdminSection({ userId, scheds }: { userId: string; scheds: Schedule[] }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [kind, setKind] = useState<Group["kind"]>("normal");
  const [schedId, setSchedId] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [nos, setNos] = useState<Record<string, string>>({});

  const load = async () => {
    const gs = await fetchAllGroups();
    setGroups(gs);
    const supabase = createClient();
    const { data } = await supabase.from("group_members").select("group_id");
    const c: Record<string, number> = {};
    for (const r of (data ?? []) as Array<{ group_id: string }>) c[r.group_id] = (c[r.group_id] ?? 0) + 1;
    setCounts(c);
  };
  useEffect(() => {
    load();
  }, []);

  const inviteBodies = async (g: Group) => {
    if (!window.confirm(`「${g.name}」に、現地入りに立候補している全員を招待しますか？（すでに入っている人はそのまま）`)) return;
    setBusy(g.id + ":body");
    const supabase = createClient();
    const { data } = await supabase.from("offers").select("user_id").eq("kind", "body").limit(1000);
    const ids = Array.from(new Set(((data ?? []) as Array<{ user_id: string }>).map((o) => o.user_id))).filter((u) => u !== OFFICE_BOT_ID);
    const n = await addGroupMembers(g.id, ids, userId);
    setBusy(null);
    window.alert(`${n}人を招待しました（対象${ids.length}人）`);
    load();
  };
  const inviteAdmins = async (g: Group) => {
    setBusy(g.id + ":admin");
    const supabase = createClient();
    const { data } = await supabase.from("admins").select("user_id");
    const ids = ((data ?? []) as Array<{ user_id: string }>).map((a) => a.user_id).filter((u) => u !== OFFICE_BOT_ID);
    const n = await addGroupMembers(g.id, ids, userId);
    setBusy(null);
    window.alert(`管理者${n}人を招待しました`);
    load();
  };
  const inviteByNo = async (g: Group) => {
    const raw = (nos[g.id] ?? "").trim();
    if (!raw) return;
    const numbers = raw.split(/[,、\s]+/).map((x) => Number(x.replace(/[^0-9]/g, ""))).filter((n) => n > 0);
    if (numbers.length === 0) return;
    setBusy(g.id + ":no");
    const supabase = createClient();
    const { data } = await supabase.from("profiles").select("id, member_no").in("member_no", numbers);
    const ids = ((data ?? []) as Array<{ id: string }>).map((p) => p.id);
    const n = await addGroupMembers(g.id, ids, userId);
    setBusy(null);
    window.alert(`${n}人を招待しました（番号が見つかったのは${ids.length}人）`);
    setNos((p) => ({ ...p, [g.id]: "" }));
    load();
  };

  const create = async () => {
    if (!name.trim()) return;
    setBusy("create");
    const { error } = await createGroup(userId, name.trim(), desc.trim(), kind, kind === "schedule" ? schedId || null : null);
    setBusy(null);
    if (error) {
      window.alert("作成できませんでした");
      return;
    }
    setName("");
    setDesc("");
    load();
  };

  return (
    <section className="rounded-2xl border border-[#c8dcf5] bg-[#f4f8ff] p-3">
      <h2 className="text-sm font-extrabold text-[#2f5d9a]">👥 グループTalK（LINEグループ相当）</h2>
      <p className="mt-1 text-[11.5px] text-[#5a6a80]">
        招待された人だけが見えるグループ。「日程調整グループ」にすると調整くん（○△×）がそのグループのトップに固定表示されます。
      </p>
      {groups.length > 0 && (
        <div className="mt-2 space-y-2">
          {groups.map((g) => (
            <div key={g.id} className="rounded-xl border border-[#dde6f2] bg-white p-2.5 text-[12.5px]">
              <div className="flex items-center gap-2">
                <span className="text-base">{g.kind === "schedule" ? "📅" : "👥"}</span>
                <span className="min-w-0 flex-1 truncate font-bold text-[#3a3428]">{g.name}</span>
                <span className="num text-[10.5px] text-[#a09888]">{counts[g.id] ?? 0}人</span>
                <Link href={`/talk/group/${g.id}`} className="text-[11px] font-bold no-underline" style={{ color: "#d96a1a" }}>
                  開く →
                </Link>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  disabled={busy !== null}
                  onClick={() => inviteBodies(g)}
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-40"
                  style={{ background: "#2f5d9a" }}
                >
                  🏃 現地入り立候補者を全員招待
                </button>
                <button
                  disabled={busy !== null}
                  onClick={() => inviteAdmins(g)}
                  className="rounded-full border px-2.5 py-1 text-[11px] font-bold disabled:opacity-40"
                  style={{ color: "#2f5d9a", borderColor: "#9dbbe0", background: "#fff" }}
                >
                  管理者を招待
                </button>
              </div>
              <div className="mt-1.5 flex gap-1.5">
                <input
                  value={nos[g.id] ?? ""}
                  onChange={(e) => setNos((p) => ({ ...p, [g.id]: e.target.value }))}
                  placeholder="わらわ〜番号で招待（例: 4, 12, 30）"
                  className="min-w-0 flex-1 rounded-lg border px-2 py-1 text-[12px]"
                  style={{ borderColor: "#dde6f2" }}
                />
                <button
                  disabled={busy !== null || !(nos[g.id] ?? "").trim()}
                  onClick={() => inviteByNo(g)}
                  className="rounded-lg px-2.5 text-[11px] font-bold text-white disabled:opacity-40"
                  style={{ background: "#2f5d9a" }}
                >
                  招待
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 rounded-xl border border-[#dde6f2] bg-white p-3">
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-[13px]" style={{ borderColor: "#dde6f2" }} placeholder="グループ名（例: 現地入り説明会Zoom日程調整グループ）" />
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} className="mt-2 w-full rounded-lg border px-3 py-2 text-[13px]" style={{ borderColor: "#dde6f2" }} placeholder="説明（グループの一番上に出ます・任意）" />
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
          <label className="flex items-center gap-1">
            <input type="radio" checked={kind === "normal"} onChange={() => setKind("normal")} /> ふつうのグループ
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={kind === "schedule"} onChange={() => setKind("schedule")} /> 📅 日程調整グループ
          </label>
        </div>
        {kind === "schedule" && (
          <select value={schedId} onChange={(e) => setSchedId(e.target.value)} className="mt-2 w-full rounded-lg border px-2 py-2 text-[12.5px]" style={{ borderColor: "#dde6f2" }}>
            <option value="">— 固定する日程調整を選ぶ —</option>
            {scheds.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
                {s.closed ? "（終了）" : ""}
              </option>
            ))}
          </select>
        )}
        <button
          disabled={busy !== null || !name.trim() || (kind === "schedule" && !schedId)}
          onClick={create}
          className="mt-2 w-full rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40"
          style={{ background: "#2f5d9a" }}
        >
          👥 グループを作成する
        </button>
      </div>
    </section>
  );
}

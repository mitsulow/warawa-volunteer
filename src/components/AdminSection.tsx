"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addAdmin,
  fetchAdminIds,
  fetchMembers,
  removeAdmin,
  type Profile,
} from "@/lib/db";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";

/** 事務局だけに見える: 事務局権限の認定・解除（名前/No.で検索）＋登録者数・最新No.の確認 */
export function AdminSection({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Profile[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const reload = async () => {
    const [m, a] = await Promise.all([fetchMembers(), fetchAdminIds()]);
    setMembers(m);
    setAdminIds(a);
  };
  useEffect(() => {
    if (open) reload();
  }, [open]);

  const maxNo = useMemo(() => members.reduce((mx, m) => Math.max(mx, m.member_no ?? 0), 0), [members]);
  const admins = useMemo(() => members.filter((m) => adminIds.has(m.id)), [members, adminIds]);
  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase().replace(/^no\.?/, "");
    if (!k) return [];
    return members
      .filter((m) => (m.display_name ?? "").toLowerCase().includes(k) || String(m.member_no ?? "") === k)
      .slice(0, 50);
  }, [q, members]);

  const toggle = async (m: Profile) => {
    const isAdmin = adminIds.has(m.id);
    if (isAdmin) {
      const self = m.id === userId;
      const ok = window.confirm(
        self
          ? "自分自身の事務局権限を解除します。よろしいですか？"
          : `${m.display_name} さんの事務局権限を解除しますか？`
      );
      if (!ok) return;
    } else if (!window.confirm(`${m.display_name} さんを事務局（管理者）にしますか？`)) {
      return;
    }
    setBusy(true);
    if (isAdmin) await removeAdmin(m.id);
    else await addAdmin(m.id);
    setBusy(false);
    reload();
  };

  const row = (m: Profile) => {
    const isAdmin = adminIds.has(m.id);
    return (
      <div key={m.id} className="flex items-center gap-3 px-4 py-2">
        <Link href={`/u/${m.id}`} className="shrink-0" aria-label="マイページ">
          <Avatar name={m.display_name} url={m.avatar_url} size={32} />
        </Link>
        <Link href={`/u/${m.id}`} className="min-w-0 flex-1 truncate text-sm text-[#3a3428] no-underline">
          {m.display_name || "参加者"}
          {m.member_no != null && <span className="num ml-1.5 text-[11px] text-[#a09888]">No.{m.member_no}</span>}
          {isAdmin && " 👑"}
          {m.id === userId && "（私）"}
        </Link>
        <button
          className={`rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
            isAdmin ? "border border-gray-300 text-gray-600" : "bg-[#d96a1a] text-white"
          }`}
          disabled={busy}
          onClick={() => toggle(m)}
        >
          {isAdmin ? "解除" : "事務局にする"}
        </button>
      </div>
    );
  };

  return (
    <section className="py-1">
      <button
        className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-bold">🏛 この人を事務局にする</span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {/* 登録者数と最新の わらわ〜No. */}
          <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-2.5 text-[12.5px] shadow-sm">
            <span className="text-[#5a5448]">
              登録者 <b className="num">{members.length.toLocaleString()}</b> 人
            </span>
            <span className="text-[#5a5448]">
              最新 <b className="num">@わらわ〜ボランティアNo.{maxNo.toLocaleString()}</b>
            </span>
          </div>

          {/* いまの事務局 */}
          <div className="rounded-xl bg-white shadow-sm">
            <p className="px-4 pt-2 text-[11px] font-bold text-[#a09888]">👑 いまの事務局（{admins.length}人）</p>
            <div className="divide-y divide-gray-100">{admins.map(row)}</div>
          </div>

          {/* 検索 */}
          <div className="rounded-xl bg-white shadow-sm">
            <div className="px-3 pt-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="名前 または わらわ〜No. で検索（例: さやか / 604）"
                className="w-full rounded-xl border px-3 py-2 text-[13.5px] outline-none focus:border-[#d96a1a]"
                style={{ borderColor: "#e0d6c6" }}
              />
              <p className="mt-1 pb-1 text-[10.5px] text-[#a09888]">
                {q.trim() ? `${filtered.length}件（最大50件表示）` : "登録者が多いので、検索してから「事務局にする」を押してください"}
              </p>
            </div>
            <div className="divide-y divide-gray-100">{filtered.map(row)}</div>
          </div>
        </div>
      )}
    </section>
  );
}

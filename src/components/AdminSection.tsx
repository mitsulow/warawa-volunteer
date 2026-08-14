"use client";

import { useEffect, useState } from "react";
import {
  addAdmin,
  fetchAdminIds,
  fetchMembers,
  removeAdmin,
  type Profile,
} from "@/lib/db";
import { Avatar } from "@/components/Avatar";

/** 管理者だけに見える: 管理者の追加・解除 */
export function AdminSection({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Profile[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const [m, a] = await Promise.all([fetchMembers(), fetchAdminIds()]);
    setMembers(m);
    setAdminIds(a);
  };
  useEffect(() => {
    if (open) reload();
  }, [open]);

  const toggle = async (m: Profile) => {
    const isAdmin = adminIds.has(m.id);
    if (isAdmin) {
      const self = m.id === userId;
      const ok = window.confirm(
        self
          ? "自分自身の管理者権限を解除します。よろしいですか？"
          : `${m.display_name} さんの管理者権限を解除しますか？`
      );
      if (!ok) return;
    }
    setBusy(true);
    if (isAdmin) await removeAdmin(m.id);
    else await addAdmin(m.id);
    setBusy(false);
    reload();
  };

  return (
    <section className="px-4 py-6">
      <button
        className="w-full rounded-xl bg-white shadow-sm px-4 py-3 flex items-center justify-between"
        onClick={() => setOpen(!open)}
      >
        <span className="font-bold text-sm">🛠 管理者の管理</span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-2 rounded-xl bg-white shadow-sm divide-y divide-gray-100">
          {members.map((m) => {
            const isAdmin = adminIds.has(m.id);
            return (
              <div key={m.id} className="flex items-center gap-3 px-4 py-2">
                <Avatar name={m.display_name} url={m.avatar_url} size={32} />
                <span className="flex-1 text-sm truncate">
                  {m.display_name || "参加者"}
                  {isAdmin && " 👑"}
                  {m.id === userId && "（私）"}
                </span>
                <button
                  className={`text-xs px-3 py-1.5 rounded-full font-bold disabled:opacity-50 ${
                    isAdmin
                      ? "border border-gray-300 text-gray-600"
                      : "bg-[#d96a1a] text-white"
                  }`}
                  disabled={busy}
                  onClick={() => toggle(m)}
                >
                  {isAdmin ? "解除" : "管理者にする"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

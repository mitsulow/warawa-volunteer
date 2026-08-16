"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import {
  type NotificationRow,
  fetchNotifications,
  markNotifRead,
  markNotifsRead,
  notifText,
} from "@/lib/notifications";

/* eslint-disable @next/next/no-img-element */

function relTime(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "たった今";
  if (s < 3600) return `${Math.floor(s / 60)}分前`;
  if (s < 86400) return `${Math.floor(s / 3600)}時間前`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}日前`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 🔔 お知らせページ（OneSea準拠）— 未読は濃く、既読は薄く。既読はタップした分だけ */
export default function NotificationsPage() {
  const [me, setMe] = useState<User | null>(null);
  const [rows, setRows] = useState<NotificationRow[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getSession()
      .then(async ({ data }: { data: { session: { user: User } | null } }) => {
        const u = data.session?.user ?? null;
        setMe(u);
        if (!u) {
          setRows([]);
          return;
        }
        setRows(await fetchNotifications(u.id));
        // 全既読はしない: タップして「見たヤツ」だけ既読にして、ベルの数字から1つずつ消す
      });
  }, []);

  /* 見たお知らせだけ既読に(タップ時) */
  const readOne = (ids: string[]) => {
    if (!me || !ids.length) return;
    setRows((prev) =>
      (prev ?? []).map((r) =>
        ids.includes(r.id) ? { ...r, read_at: r.read_at ?? new Date().toISOString() } : r
      )
    );
    markNotifRead(me.id, ids).then(() => {
      window.dispatchEvent(new Event("warawa:notifRefresh"));
    });
  };

  const readAll = () => {
    if (!me) return;
    setRows((prev) =>
      (prev ?? []).map((r) => ({ ...r, read_at: r.read_at ?? new Date().toISOString() }))
    );
    markNotifsRead(me.id).then(() => {
      window.dispatchEvent(new Event("warawa:notifRefresh"));
    });
  };

  return (
    <main className="min-h-screen pb-24" style={{ background: "#faf6ee" }}>
      <header className="sticky top-0 z-30 border-b border-[#ede5d8] bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link href="/" className="shrink-0 rounded-full border px-3 py-1 text-[12.5px] font-bold no-underline" style={{ color: "#d96a1a", borderColor: "#f0d0a8", background: "#fff" }} aria-label="戻る">
            戻る
          </Link>
          <h1 className="text-[17px] font-bold" style={{ color: "#d96a1a" }}>
            🔔 お知らせ
          </h1>
          {(rows ?? []).some((r) => !r.read_at) && (
            <button
              onClick={readAll}
              className="ml-auto rounded-full border border-[#e0d8c8] px-2.5 py-1 text-[10.5px] font-bold text-[#8a8070]"
            >
              全部既読にする
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-[480px]">
        {rows === null ? (
          <p className="py-10 text-center text-[13px] text-[#a09888]">読み込み中...</p>
        ) : !me ? (
          <p className="py-10 text-center text-[13px] text-[#a09888]">
            ログインするとお知らせが届きます
          </p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-[#a09888]">
            まだお知らせはありません。
            <br />
            あなたの投稿へのコメントがここに届きます
          </p>
        ) : (
          rows.map((n) => {
            const unread = !n.read_at;
            const inner = (
              <div
                className="flex items-start gap-2.5 border-b border-[#f0ece0] px-4 py-3"
                style={{ opacity: unread ? 1 : 0.55, background: unread ? "#fffaf0" : "transparent" }}
              >
                {n.profiles?.avatar_url ? (
                  <img
                    src={n.profiles.avatar_url}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#f0ece0] text-[14px]">
                    🔔
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[13px] leading-snug text-[#3a3428]"
                    style={{ fontWeight: unread ? 800 : 400 }}
                  >
                    {notifText(n)}
                  </div>
                  {n.excerpt && (
                    <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-[#8a8070]">
                      「{n.excerpt}」
                    </div>
                  )}
                  <div className="num mt-0.5 text-[10px] text-[#b0a890]">{relTime(n.created_at)}</div>
                </div>
                {unread && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#e05040]" />}
              </div>
            );
            return n.target_url ? (
              <Link
                key={n.id}
                href={n.target_url}
                className="block no-underline"
                onClick={() => readOne([n.id])}
              >
                {inner}
              </Link>
            ) : (
              <div key={n.id} onClick={() => readOne([n.id])}>
                {inner}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}

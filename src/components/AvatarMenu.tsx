"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { Profile } from "@/lib/db";
import { fetchNotifUnread } from "@/lib/notifications";

/**
 * 右上アバターメニュー（OneSeaのAvatarMenuと同じ挙動）:
 * アバターを押すとメニューが並び、一番下に「ログアウト」。
 */
export function AvatarMenu({
  userId,
  profile,
  isAdmin = false,
}: {
  userId: string;
  profile: Profile;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [notifN, setNotifN] = useState(0); // 🔔お知らせ未読
  const ref = useRef<HTMLDivElement>(null);

  // お知らせ未読（20秒プローブ + 既読化イベントで即時更新・OneSea方式）
  useEffect(() => {
    let alive = true;
    const probe = async () => {
      if (document.hidden) return;
      const n = await fetchNotifUnread(userId).catch(() => 0);
      if (alive) setNotifN(n);
    };
    probe();
    const timer = setInterval(probe, 20000);
    window.addEventListener("warawa:notifRefresh", probe);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("warawa:notifRefresh", probe);
    };
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const item =
    "flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] font-bold text-[#3a3428] no-underline active:bg-[#f5efe2] w-full text-left";

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-label="メニュー" className="relative block">
        {notifN > 0 && (
          <span
            className="num absolute -right-1.5 -top-1.5 z-10 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#e05040] px-1 text-[10px] font-extrabold text-white"
            style={{ lineHeight: 1, boxShadow: "0 0 0 1.5px #fff" }}
          >
            {notifN > 99 ? "99+" : notifN}
          </span>
        )}
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt=""
            referrerPolicy="no-referrer"
            className="h-9 w-9 rounded-full object-cover"
            style={{ boxShadow: "0 0 0 2px #d96a1a" }}
          />
        ) : (
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full font-bold text-white"
            style={{ background: "#d96a1a" }}
          >
            {profile.display_name.charAt(0) || "参"}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-2xl border border-[#ede5d8] bg-white shadow-2xl">
          <div className="border-b border-[#f0e9dc] px-4 py-2.5">
            <p className="truncate text-[13px] font-bold text-[#3a3428]">
              {profile.display_name}
            </p>
            {profile.member_no != null && (
              <p className="num text-[10.5px] text-[#a09888]">
                @わらわ〜ボランティアNo.{profile.member_no}
              </p>
            )}
          </div>
          <Link href="/notifications" className={item} onClick={() => setOpen(false)}>
            <span className="flex h-5 w-5 items-center justify-center text-[16px]">🔔</span>
            お知らせ
            {notifN > 0 && (
              <span
                className="num ml-auto flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#e05040] px-1 text-[9.5px] font-bold text-white"
                style={{ lineHeight: 1 }}
              >
                {notifN > 99 ? "99+" : notifN}
              </span>
            )}
          </Link>
          <Link href="/talk" className={item} onClick={() => setOpen(false)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-talk-green.webp" alt="" className="h-5 w-5 object-contain" />
            TalK
          </Link>
          <Link href={`/u/${userId}`} className={item} onClick={() => setOpen(false)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-meishi.webp" alt="" className="h-5 w-5 object-contain" />
            マイページ
          </Link>
          <Link href="/guide" className={item} onClick={() => setOpen(false)}>
            📖 使い方
          </Link>
          {isAdmin && (
            <Link href="/office" className={`${item} border-t border-[#f0e9dc]`} onClick={() => setOpen(false)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-megaphone.webp" alt="" className="h-5 w-5 object-contain" />
              事務局ページ
            </Link>
          )}
          <button
            className={`${item} border-t border-[#f0e9dc]`}
            onClick={logout}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-logout.webp" alt="" className="h-5 w-5 object-contain" />
            <span className="text-[#c04030]">ログアウト</span>
          </button>
        </div>
      )}
    </div>
  );
}

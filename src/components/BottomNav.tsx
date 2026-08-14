"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { fetchUnreadTotal } from "@/lib/db";

/**
 * 下部ナビ: 左=マイページ / 中央=ホーム / 右=TalK（OneSeaのタブアイコンを利用）。
 * TalKには未読件数バッジ。20秒間隔の軽量プローブ（hidden中は停止）。
 */
export function BottomNav({
  userId,
  active,
  requireJoin,
}: {
  userId: string | null;
  active: "home" | "talk" | "my";
  requireJoin?: () => void;
}) {
  const [unread, setUnread] = useState(0);
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setUnread(0);
      setAvatar(null);
      return;
    }
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }: { data: { avatar_url: string | null } | null }) =>
        setAvatar(data?.avatar_url ?? null)
      );
    let alive = true;
    const probe = async () => {
      if (document.hidden) return;
      const n = await fetchUnreadTotal(userId);
      if (alive) setUnread(n);
    };
    probe();
    const timer = setInterval(probe, 20000);
    const onRefresh = () => probe();
    window.addEventListener("warawa:unreadRefresh", onRefresh);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("warawa:unreadRefresh", onRefresh);
    };
  }, [userId]);

  const cls = (key: string) =>
    `flex-1 flex flex-col items-center py-1.5 relative no-underline ${
      active === key ? "text-[#1e6b3a] font-bold" : "text-[#8a8070]"
    }`;

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 flex w-full max-w-[520px] -translate-x-1/2 border-t border-[#ede5d8] bg-white pb-[env(safe-area-inset-bottom)]">
      {/* マイページ */}
      {userId ? (
        <Link href={`/u/${userId}`} className={cls("my")}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              referrerPolicy="no-referrer"
              className="h-6 w-6 rounded-full object-cover"
              style={active === "my" ? { boxShadow: "0 0 0 2px #1e6b3a" } : undefined}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/icons/icon-meishi.webp" alt="" className="h-6 w-6 object-contain" />
          )}
          <span className="mt-0.5 text-[10px]">マイページ</span>
        </Link>
      ) : (
        <button className={cls("my")} onClick={requireJoin}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-meishi.webp" alt="" className="h-6 w-6 object-contain" />
          <span className="mt-0.5 text-[10px]">マイページ</span>
        </button>
      )}

      {/* ホーム */}
      <Link href="/" className={cls("home")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/tab-home.png" alt="" className="h-6 w-6 object-contain" />
        <span className="mt-0.5 text-[10px]">ホーム</span>
      </Link>

      {/* TalK */}
      <Link href="/talk" className={cls("talk")}>
        <span className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-talk-green.webp" alt="" className="h-6 w-6 object-contain" />
          {unread > 0 && (
            <span className="absolute -right-2.5 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </span>
        <span className="mt-0.5 text-[10px]">TalK</span>
      </Link>
    </nav>
  );
}

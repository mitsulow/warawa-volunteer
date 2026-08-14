"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

/**
 * 下部ナビ: ホーム / TalK。
 * TalKには未読件数バッジ。20秒間隔の軽量プローブ（件数だけ・hidden中は停止）。
 */
export function BottomNav({
  userId,
  active,
}: {
  userId: string | null;
  active: "home" | "talk";
}) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId) {
      setUnread(0);
      return;
    }
    const supabase = createClient();
    let alive = true;
    const probe = async () => {
      if (document.hidden) return;
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .is("read_at", null)
        .neq("sender_id", userId);
      if (alive) setUnread(count ?? 0);
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

  const item = (href: string, label: string, emoji: string, key: "home" | "talk") => (
    <Link
      href={href}
      className={`flex-1 flex flex-col items-center py-2 relative ${
        active === key ? "text-[#d96c2c] font-bold" : "text-gray-500"
      }`}
    >
      <span className="text-xl leading-none">
        {emoji}
        {key === "talk" && unread > 0 && (
          <span className="absolute top-1 ml-1 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </span>
      <span className="text-xs mt-0.5">{label}</span>
    </Link>
  );

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[520px] bg-white border-t border-gray-200 flex z-40 pb-[env(safe-area-inset-bottom)]">
      {item("/", "ホーム", "🏠", "home")}
      {item("/talk", "TalK", "💬", "talk")}
    </nav>
  );
}

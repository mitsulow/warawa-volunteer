"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchUnreadTotal } from "@/lib/db";

/**
 * 右下のTalKアイコン（バーなし・アイコンだけの浮きボタン）。
 * 普段は隠れていて、①TalK未読がある時は常時表示
 * ②上へスクロールした時 ③画面下端に触れた/カーソルを寄せた時 に出てくる。
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
  void requireJoin;
  void active;
  const [unread, setUnread] = useState(0);
  const [shown, setShown] = useState(true);
  const hideTimer = useRef<number | null>(null);
  const lastY = useRef(0);

  useEffect(() => {
    if (!userId) {
      setUnread(0);
      return;
    }
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

  // 自動非表示の制御
  useEffect(() => {
    const showTemp = () => {
      setShown(true);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setShown(false), 2500);
    };

    // 開いた直後は数秒見せてから隠す
    showTemp();

    const onScroll = () => {
      const y = window.scrollY;
      if (y < lastY.current - 4) showTemp(); // 上へスクロール → 出す
      lastY.current = y;
    };
    // 画面下端にカーソル/タッチが近づいたら出す（タスクバー方式）
    const onMove = (e: MouseEvent) => {
      if (e.clientY > window.innerHeight - 28) showTemp();
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t && t.clientY > window.innerHeight - 40) showTemp();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchstart", onTouch);
    };
  }, []);

  // 未読がある時は常時表示
  const visible = unread > 0 || shown;

  return (
    <Link
      href="/talk"
      aria-label="TalK"
      className="fixed z-40 flex h-12 w-12 items-center justify-center rounded-full border border-[#ede5d8] bg-white shadow-lg transition-all duration-300"
      style={{
        right: "max(14px, calc(50% - 246px))",
        bottom: "calc(env(safe-area-inset-bottom) + 14px)",
        transform: visible ? "translateY(0)" : "translateY(90px)",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-talk-green.webp" alt="TalK" className="h-7 w-7 object-contain" />
      {unread > 0 && (
        <span className="num absolute -right-1 -top-1 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-none text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

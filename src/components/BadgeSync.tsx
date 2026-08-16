"use client";

import { useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { fetchUnreadTotal } from "@/lib/db";

/**
 * PWAアイコンの未読バッジ同期（App Badging API）。
 * TalKの未読（DM + グループ2部屋）の合計をアイコンに「④」のように表示する。
 * 対応: Android Chrome / PC Chrome・Edge / iOS 16.4+（ホーム画面追加済みのみ）。
 * 注意: アプリを閉じている間の新着は、開いた時に反映される（Web Push導入までの仕様）。
 */
export function BadgeSync() {
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (typeof nav.setAppBadge !== "function") return;

    const supabase = createClient();
    let userId: string | null = null;
    let alive = true;

    const sync = async () => {
      if (!alive || !userId) return;
      try {
        const n = await fetchUnreadTotal(userId);
        if (!alive) return;
        if (n > 0) await nav.setAppBadge!(n);
        else await nav.clearAppBadge?.();
      } catch {}
    };

    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) => {
        userId = data.session?.user?.id ?? null;
        if (userId) sync();
        else nav.clearAppBadge?.().catch(() => {});
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e: string, session: Session | null) => {
      userId = session?.user?.id ?? null;
      if (userId) sync();
      else nav.clearAppBadge?.().catch(() => {});
    });

    const timer = setInterval(() => {
      if (!document.hidden) sync();
    }, 60000);
    const onRefresh = () => sync();
    const onVisible = () => {
      if (!document.hidden) sync();
    };
    window.addEventListener("warawa:unreadRefresh", onRefresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      subscription.unsubscribe();
      window.removeEventListener("warawa:unreadRefresh", onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}

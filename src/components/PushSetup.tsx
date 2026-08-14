"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { pushSupported, requestAndSubscribe, subscribePush } from "@/lib/push";

/**
 * プッシュ通知の案内バナー。
 * ログイン済み + 未許可のときに表示。「オンにする」で許可→購読。
 * 許可済みの人は静かに購読を最新化。×は3時間スヌーズ。
 */
export function PushSetup() {
  const [userId, setUserId] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    const supabase = createClient();
    const check = (uid: string | null) => {
      setUserId(uid);
      if (!uid) {
        setShow(false);
        return;
      }
      if (Notification.permission === "granted") {
        subscribePush(uid);
        setShow(false);
      } else if (Notification.permission === "default") {
        try {
          const snoozed = localStorage.getItem("warawa-push-snooze");
          if (snoozed && Date.now() - Number(snoozed) < 3 * 3600000) return;
        } catch {}
        setShow(true);
      }
    };
    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) =>
        check(data.session?.user?.id ?? null)
      );
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e: string, session: Session | null) =>
      check(session?.user?.id ?? null)
    );
    return () => subscription.unsubscribe();
  }, []);

  if (!show || !userId) return null;

  const enable = async () => {
    const perm = await requestAndSubscribe(userId);
    if (perm !== "default") setShow(false);
  };

  const snooze = () => {
    try {
      localStorage.setItem("warawa-push-snooze", String(Date.now()));
    } catch {}
    setShow(false);
  };

  return (
    <div className="fixed bottom-[124px] left-1/2 z-50 w-[calc(100%-24px)] max-w-[496px] -translate-x-1/2">
      <div
        className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 shadow-xl"
        style={{ background: "linear-gradient(120deg,#d96a1a,#a84e0e)" }}
      >
        <span className="text-2xl">🔔</span>
        <p className="min-w-0 flex-1 text-[13px] font-extrabold leading-tight text-white">
          TalKの新着をプッシュ通知で受け取れます
        </p>
        <button
          className="flex-shrink-0 rounded-full bg-white px-3 py-1.5 text-[12px] font-extrabold"
          style={{ color: "#a84e0e" }}
          onClick={enable}
        >
          オンにする
        </button>
        <button
          className="flex-shrink-0 px-1 text-[18px] text-white/70"
          aria-label="あとで"
          onClick={snooze}
        >
          ×
        </button>
      </div>
    </div>
  );
}

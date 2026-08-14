"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { fetchIsAdmin, fetchMyProfile, type Profile } from "@/lib/db";

export interface SessionState {
  loading: boolean;
  userId: string | null;
  profile: Profile | null;
  isAdmin: boolean;
  refresh: () => void;
}

/** ログイン状態 + プロフィール。匿名認証もメールログインも同じ扱い */
export function useSession(): SessionState {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;

    const load = async (uid: string | null) => {
      if (!alive) return;
      setUserId(uid);
      if (uid) {
        const [p, admin] = await Promise.all([
          fetchMyProfile(uid),
          fetchIsAdmin(uid),
        ]);
        if (!alive) return;
        setProfile(p);
        setIsAdmin(admin);
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
      setLoading(false);
    };

    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) => {
        load(data.session?.user?.id ?? null);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e: string, session: Session | null) => {
      load(session?.user?.id ?? null);
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [tick]);

  return { loading, userId, profile, isAdmin, refresh };
}

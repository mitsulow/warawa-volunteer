"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { Profile } from "@/lib/db";

/**
 * 右上アバターメニュー（OneSeaのAvatarMenuと同じ挙動）:
 * アバターを押すとメニューが並び、一番下に「ログアウト」。
 */
export function AvatarMenu({
  userId,
  profile,
}: {
  userId: string;
  profile: Profile;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
      <button onClick={() => setOpen(!open)} aria-label="メニュー" className="block">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt=""
            referrerPolicy="no-referrer"
            className="h-9 w-9 rounded-full object-cover"
            style={{ boxShadow: "0 0 0 2px #1e6b3a" }}
          />
        ) : (
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full font-bold text-white"
            style={{ background: "#1e6b3a" }}
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
                @ボランティアNo.{profile.member_no}
              </p>
            )}
          </div>
          <Link href="/" className={item} onClick={() => setOpen(false)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/tab-home.png" alt="" className="h-5 w-5 object-contain" />
            ホーム
          </Link>
          <Link href="/voice" className={item} onClick={() => setOpen(false)}>
            📣 現地からの声
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
          <button
            className={`${item} border-t border-[#f0e9dc] text-[#c04030]`}
            onClick={logout}
          >
            🚪 ログアウト
          </button>
        </div>
      )}
    </div>
  );
}

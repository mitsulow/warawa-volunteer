"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { fetchIsAdmin } from "@/lib/db";

/* eslint-disable @next/next/no-img-element */

/**
 * 左上の三本線メニュー（OneSeaのSekaiMenuButton方式）。
 * inline=ヘッダー内に置く（通常はこちら）/ floating=ヘッダーが無いページ用に左上へ浮かせる。
 * light=オレンジ帯ヘッダー用の白い☰。押すと左からドロワーが開く。
 */
export function MenuButton({
  inline = false,
  light = false,
}: {
  inline?: boolean;
  light?: boolean;
} = {}) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [homeTab, setHomeTab] = useState("offers");
  const path = typeof window !== "undefined" ? window.location.pathname : "";

  // ホームで開いているタブをハイライトに反映
  useEffect(() => {
    try {
      const t = localStorage.getItem("warawa-tab3");
      if (t) setHomeTab(t);
    } catch {}
  }, [open]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getSession()
      .then(async ({ data }: { data: { session: { user: { id: string } } | null } }) => {
        const uid = data.session?.user?.id ?? null;
        setUserId(uid);
        if (uid) setAdmin(await fetchIsAdmin(uid));
      });
  }, []);

  const logout = async () => {
    await createClient().auth.signOut();
    window.location.href = "/";
  };

  const MENU: Array<{ href: string; icon: string; label: string }> = [
    { href: "/?tab=offers", icon: "/icons/icon-heart.webp", label: "助けたい" },
    { href: "/?tab=voice", icon: "/icons/icon-tasukete.webp", label: "助けて" },
    { href: "/?tab=board", icon: "/icons/icon-kokuban.webp", label: "掲示板" },
    { href: "/talk", icon: "/icons/icon-talk-green.webp", label: "TalK" },
    ...(userId
      ? [{ href: `/u/${userId}`, icon: "/icons/icon-meishi.webp", label: "マイページ" }]
      : []),
    { href: "/guide", icon: "/icons/icon-star.webp", label: "使い方" },
    { href: "/terms", icon: "/icons/icon-post.webp", label: "ご利用にあたって" },
    ...(admin
      ? [{ href: "/office", icon: "/icons/icon-megaphone.webp", label: "事務局ページ" }]
      : []),
  ];

  return (
    <>
      {inline ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="メニュー"
          className="text-[22px] leading-none"
          style={{ color: light ? "#fff" : "#d96a1a" }}
        >
          ☰
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="メニュー"
          className="fixed z-[70] flex h-9 w-9 items-center justify-center rounded-full border border-[#f0e0cc] bg-white text-[19px] leading-none shadow-md"
          style={{
            color: "#d96a1a",
            top: "calc(env(safe-area-inset-top) + 8px)",
            left: "max(10px, calc(50% - 250px))",
          }}
        >
          ☰
        </button>
      )}
      {/* ドロワーはbody直下にポータルで出す:
          backdrop-blur等のあるヘッダー内に置くとfixedがヘッダー基準になり見えなくなるため */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
        <>
          <div className="fixed inset-0 z-[210] bg-black/35" onClick={() => setOpen(false)} />
          <div className="fixed left-0 top-0 z-[211] h-full w-[270px] overflow-y-auto bg-white shadow-2xl">
            <div className="px-5 pb-2 pt-5">
              <div className="text-[10px] tracking-[1px] text-[#e0a06a]">
                届けたいのは「大丈夫」、配りたいのは「笑顔」。
              </div>
              <div className="flex items-center gap-2 text-[19px] font-extrabold" style={{ color: "#d96a1a" }}>
                {/* OneSeaのドロワーと同じく、見出しの先頭にキャラアイコン */}
                <img src="/waraeru-v2.png" alt="" className="h-[26px] w-[26px] object-contain" />
                わらわ〜ボランティア
              </div>
            </div>
            {MENU.map((m) => {
              const base = m.href.split("?")[0];
              const here =
                base === "/"
                  ? path === "/" && m.href === `/?tab=${homeTab}`
                  : path.startsWith(base);
              return (
                <a
                  key={m.href}
                  href={m.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 border-b border-[#f6efe4] px-5 py-3 text-[14px] no-underline ${
                    here ? "bg-[#fdeedd] font-bold text-[#c05e14]" : "font-medium text-[#3a3428]"
                  }`}
                >
                  <img src={m.icon} alt="" className="h-[22px] w-[22px] object-contain" />
                  {m.label}
                </a>
              );
            })}
            <button
              className="flex w-full items-center gap-3 border-b border-[#f6efe4] px-5 py-3 text-left text-[14px] font-medium text-[#3a3428]"
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new Event("warawa:installPrompt"));
              }}
            >
              <img src="/icons/tab-home.png" alt="" className="h-[22px] w-[22px] object-contain" />
              ホーム画面に追加
            </button>
            {userId ? (
              <button
                className="flex w-full items-center gap-3 px-5 py-3 text-left text-[14px] font-medium text-[#c04030]"
                onClick={logout}
              >
                <img src="/icons/icon-logout.webp" alt="" className="h-[22px] w-[22px] object-contain" />
                ログアウト
              </button>
            ) : (
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-5 py-3 text-[14px] font-bold no-underline"
                style={{ color: "#d96a1a" }}
              >
                ○ 参加する
              </Link>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

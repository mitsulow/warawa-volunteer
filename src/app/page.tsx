"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { fetchOffers, type Offer } from "@/lib/db";
import { JoinDialog } from "@/components/JoinDialog";
import { RegisterDialog } from "@/components/RegisterDialog";
import { FeaturedGoods } from "@/components/FeaturedGoods";
import { OrangeCorps } from "@/components/OrangeCorps";
import { OffersSection } from "@/components/OffersSection";
import { GroupFeed } from "@/components/GroupFeed";
import { ActivityFeed } from "@/components/ActivityFeed";
import { AvatarMenu } from "@/components/AvatarMenu";
import { BottomNav } from "@/components/BottomNav";
import { MenuButton } from "@/components/MenuButton";

type Tab = "voice" | "offers" | "board";

export default function Home() {
  const session = useSession();
  const [showJoin, setShowJoin] = useState(false);
  const [googleMeta, setGoogleMeta] = useState<{
    name: string;
    avatar: string | null;
    email: string;
  } | null>(null);
  const [tab, setTabState] = useState<Tab>("offers");
  // タブ位置を記憶: リロードしても選んでいたタブから始まる
  useEffect(() => {
    try {
      // ☰メニューからの ?tab= 指定が最優先
      const q = new URLSearchParams(window.location.search).get("tab") as Tab | null;
      if (q === "board" || q === "offers" || q === "voice") {
        setTabState(q);
        localStorage.setItem("warawa-tab3", q);
        window.history.replaceState(null, "", "/");
        return;
      }
      const t = localStorage.getItem("warawa-tab3") as Tab | null;
      if (t === "board" || t === "offers" || t === "voice") setTabState(t);
    } catch {}
  }, []);
  const setTab = (t: Tab) => {
    setTabState(t);
    try {
      localStorage.setItem("warawa-tab3", t);
    } catch {}
  };
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    fetchOffers().then(setOffers);
  }, [tab]);

  // Googleログイン直後でプロフィール未作成 → 登録フォームを出す。
  // プロフィールはあるがアバターが空（事前登録など）→ Googleの写真を自動で入れる
  useEffect(() => {
    if (session.loading || !session.userId) {
      setGoogleMeta(null);
      return;
    }
    const supabase = createClient();
    if (session.profile) {
      setGoogleMeta(null);
      if (!session.profile.avatar_url) {
        supabase.auth.getUser().then(async ({ data }: { data: { user: User | null } }) => {
          const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
          const pic = (meta.picture as string) || (meta.avatar_url as string) || null;
          if (pic) {
            await supabase
              .from("profiles")
              .update({ avatar_url: pic })
              .eq("id", session.userId!);
            session.refresh();
          }
        });
      }
      return;
    }
    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      setGoogleMeta({
        name: (meta.full_name as string) || (meta.name as string) || "",
        avatar: (meta.picture as string) || (meta.avatar_url as string) || null,
        email: data.user?.email ?? "",
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.userId, session.profile, session.loading]);

  const requireJoin = () => setShowJoin(true);

  const TABS: Array<[Tab, string, string]> = [
    ["offers", "助けたい", "私にできること"],
    ["voice", "助けて", "現地からの声"],
    ["board", "掲示板", "これまでの取り組み"],
  ];
  // 選択中タブの「ひとこと説明」: タブから吹き出しの尻尾でつながる帯として表示
  const TAB_LEAD: Record<Tab, string> = {
    offers: "「わたし」に出来る事を持ち寄る",
    voice: "現地で今欲しい物、やって欲しい事の掲示板",
    board: "現地の様子・これまでの取り組みを共有する掲示板",
  };
  const tabIndex = TABS.findIndex(([id]) => id === tab);

  return (
    <main className="overflow-x-clip pb-24" style={{ background: "#faf6ee" }}>
      {/* ヘッダー: スローガン + センター寄せタイトル + 右上に丸アイコン（ゲスト=●参加 / ログイン=アバター） */}
      <header className="sticky top-0 z-40 border-b border-[#ede5d8] bg-white/95 backdrop-blur-sm">
        <div className="relative px-14 py-1.5">
          <div className="select-none text-center" style={{ color: "#d96a1a" }}>
            <p
              className="whitespace-nowrap font-semibold"
              style={{ fontSize: 10, letterSpacing: "0.04em", lineHeight: 1.2, opacity: 0.9 }}
            >
              届けたいのは「大丈夫」、配りたいのは「笑顔」。
            </p>
            <span className="mt-0.5 inline-flex items-center justify-center" style={{ gap: 7 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/waraeru-v2.png"
                alt=""
                className="h-8 w-8 flex-shrink-0 object-contain"
              />
              <span
                className="whitespace-nowrap font-bold"
                style={{ fontSize: 19, letterSpacing: "0.02em", lineHeight: 1 }}
              >
                わらわ〜ボランティア
              </span>
            </span>
          </div>

          <span className="absolute left-3 top-1/2 -translate-y-1/2">
            <MenuButton inline />
          </span>
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {session.profile && session.userId ? (
              <AvatarMenu userId={session.userId} profile={session.profile} isAdmin={session.isAdmin} />
            ) : (
              <button
                className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: "#d96a1a" }}
                onClick={requireJoin}
                aria-label="参加する"
              >
                参加
              </button>
            )}
          </span>
        </div>
      </header>

      {session.profile?.banned_at && (
        <div className="mx-4 mt-3 rounded-xl border px-3 py-2 text-[12.5px] font-bold" style={{ borderColor: "#f5b7b1", background: "#fdecea", color: "#c0392b" }}>
          🚫 このアカウントは書き込みが停止されています。閲覧はできます。心当たりがない場合は事務局までお知らせください。
        </div>
      )}
      <div className="space-y-3 px-4 pt-3">
        {/* フォルダ型タブ: 選択中のタブが下のセクションとつながって見える（画面フチまで全幅） */}
        <div className="-mx-4">
          <div className="flex gap-1 px-1">
            {TABS.map(([id, label, sub]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="relative flex-1 rounded-t-xl py-2 text-center transition-colors"
                style={
                  tab === id
                    ? {
                        background: "#d96a1a",
                        color: "#fff",
                        marginBottom: -2,
                        zIndex: 1,
                        boxShadow: "0 -2px 6px rgba(217,106,26,.25)",
                      }
                    : { background: "#f0e9da", color: "#8a8070" }
                }
              >
                <div className="text-[13px] font-extrabold leading-tight">{label}</div>
                <div className="text-[9px] leading-tight opacity-85">{sub}</div>
              </button>
            ))}
          </div>
          <div
            className="overflow-hidden rounded-b-2xl p-2"
            style={{ border: "3px solid #d96a1a", background: "#fffdf8" }}
          >
        {/* タブ直下の説明帯: 選択中タブの真下から尻尾が伸びて、タブと一体に見える */}
        <div className="relative -mx-2 -mt-2 mb-2" style={{ background: "#fdeedd", borderBottom: "1px solid #f0d0a8" }}>
          <span
            className="absolute top-0 h-0 w-0"
            style={{
              left: `calc(${(tabIndex * 2 + 1) * (100 / 6)}% - 8px)`,
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderTop: "8px solid #d96a1a",
            }}
            aria-hidden
          />
          <p className="px-3 pb-2 pt-3 text-center text-[14px] font-extrabold leading-snug" style={{ color: "#c05e14" }}>
            {TAB_LEAD[tab]}
          </p>
        </div>

        {tab === "voice" && (
          <div>
            <GroupFeed
              scope="voice"
              userId={session.userId}
              myAvatar={session.profile?.avatar_url ?? null}
              isAdmin={session.isAdmin}
              requireJoin={requireJoin}
              placeholder="こちらにお書きください"
            />
          </div>
        )}

        {tab === "offers" && (
          <div>
          <OffersSection
            userId={session.userId}
            profile={session.profile}
            isAdmin={session.isAdmin}
            requireJoin={requireJoin}
          />
          </div>
        )}

        {tab === "board" && (
          <ActivityFeed
            userId={session.userId}
            myAvatar={session.profile?.avatar_url ?? null}
            isAdmin={session.isAdmin}
            requireJoin={requireJoin}
          />
        )}
          </div>
        </div>

        {/* 現地へ届けたい物資候補（楽市楽座トップと同じく左右幅いっぱい） */}
        <div className="-mx-4">
          <FeaturedGoods offers={offers} />
        </div>

        {/* 現地入りメンバー（一番下） */}
        <OrangeCorps />

        <footer className="py-6 text-center text-sm text-[#8a8070]">
          <Link
            href="/guide"
            className="mb-3 inline-block rounded-full border-2 px-5 py-2.5 text-[15px] font-extrabold no-underline"
            style={{ borderColor: "#d96a1a", color: "#d96a1a", background: "#fff" }}
          >
            📖 使い方（かんたんガイド）
          </Link>
        </footer>
      </div>

      {showJoin && <JoinDialog onClose={() => setShowJoin(false)} />}

      {googleMeta && session.userId && (
        <RegisterDialog
          userId={session.userId}
          initial={{
            display_name: googleMeta.name,
            avatar_url: googleMeta.avatar,
            email: googleMeta.email,
            sns: null,
          }}
          isFirst
          onDone={() => {
            setGoogleMeta(null);
            session.refresh();
          }}
        />
      )}

      <BottomNav userId={session.userId} active="home" requireJoin={requireJoin} />
    </main>
  );
}

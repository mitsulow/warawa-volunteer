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

type Tab = "voice" | "offers" | "board";

export default function Home() {
  const session = useSession();
  const [showJoin, setShowJoin] = useState(false);
  const [googleMeta, setGoogleMeta] = useState<{
    name: string;
    avatar: string | null;
    email: string;
  } | null>(null);
  const [tab, setTabState] = useState<Tab>("voice");
  // タブ位置を記憶: リロードしても選んでいたタブから始まる
  useEffect(() => {
    try {
      const t = localStorage.getItem("warawa-tab2") as Tab | null;
      if (t === "board" || t === "offers" || t === "voice") setTabState(t);
    } catch {}
  }, []);
  const setTab = (t: Tab) => {
    setTabState(t);
    try {
      localStorage.setItem("warawa-tab2", t);
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
    ["voice", "助けて", "現地からの声"],
    ["offers", "助けたい", "私にできること"],
    ["board", "掲示板", "ここまでの取り組み"],
  ];

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

          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {session.profile && session.userId ? (
              <AvatarMenu userId={session.userId} profile={session.profile} />
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

      <div className="space-y-3 px-4 pt-3">
        {/* 3タブ切り替え（楽市/楽座/この指とまれ の移植） */}
        <div className="grid grid-cols-3 gap-1 rounded-2xl border border-[#ede5d8] bg-[#f5efe2] p-1">
          {TABS.map(([id, label, sub]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="rounded-xl py-2 text-center transition-colors"
              style={
                tab === id
                  ? { background: "#d96a1a", color: "#fff", boxShadow: "0 2px 8px rgba(217,106,26,.35)" }
                  : { background: "transparent", color: "#8a8070" }
              }
            >
              <div className="text-[13px] font-extrabold leading-tight">{label}</div>
              <div className="text-[9px] leading-tight opacity-85">{sub}</div>
            </button>
          ))}
        </div>

        {tab === "voice" && (
          <div>
            <p className="mb-2 text-xs font-medium text-[#8a8070]">
              現地の人の「いま欲しい物・やって欲しい事」の掲示板です。
            </p>
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
          <OffersSection
            userId={session.userId}
            profile={session.profile}
            isAdmin={session.isAdmin}
            requireJoin={requireJoin}
          />
        )}

        {tab === "board" && (
          <ActivityFeed
            userId={session.userId}
            myAvatar={session.profile?.avatar_url ?? null}
            isAdmin={session.isAdmin}
            requireJoin={requireJoin}
          />
        )}

        {/* 本日の出せる物資一覧 */}
        <FeaturedGoods offers={offers} />

        {/* 現地入りメンバー（一番下） */}
        <OrangeCorps />

        <footer className="py-6 text-center text-sm text-[#8a8070]">
          <p className="mb-1 font-bold">📱 アプリのように使えます</p>
          <p className="text-xs">
            iPhone: 共有ボタン →「ホーム画面に追加」 / Android: メニュー →「ホーム画面に追加」
          </p>
          <p className="mt-4 text-xs text-[#b8b0a0]">わらわ〜ボランティア</p>
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

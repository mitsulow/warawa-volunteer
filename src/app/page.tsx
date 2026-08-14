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
import { AdminSection } from "@/components/AdminSection";
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
  const [tab, setTab] = useState<Tab>("voice");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [goodsSignal, setGoodsSignal] = useState(0);

  useEffect(() => {
    fetchOffers().then(setOffers);
  }, [tab]);

  // Googleログイン直後でプロフィール未作成 → 登録フォームを出す
  useEffect(() => {
    if (session.loading || !session.userId || session.profile) {
      setGoogleMeta(null);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      setGoogleMeta({
        name: (meta.full_name as string) || (meta.name as string) || "",
        avatar: (meta.picture as string) || (meta.avatar_url as string) || null,
        email: data.user?.email ?? "",
      });
    });
  }, [session.userId, session.profile, session.loading]);

  const requireJoin = () => setShowJoin(true);

  const TABS: Array<[Tab, string, string]> = [
    ["voice", "現地からの声", "欲しい物・やって欲しい事"],
    ["offers", "私にできる事", "お金・体・物資"],
    ["board", "掲示板", "みんなの連絡板"],
  ];

  return (
    <main className="overflow-x-clip pb-24" style={{ background: "#faf6ee" }}>
      {/* ヘッダー: スローガン + センター寄せタイトル + 右上に丸アイコン（ゲスト=●参加 / ログイン=アバター） */}
      <header className="sticky top-0 z-40 border-b border-[#ede5d8] bg-white/95 backdrop-blur-sm">
        <div className="relative px-14 py-1.5">
          <div className="select-none text-center" style={{ color: "#c94d3a" }}>
            <p
              className="whitespace-nowrap font-semibold"
              style={{ fontSize: 10, letterSpacing: "0.04em", lineHeight: 1.2, opacity: 0.9 }}
            >
              届けるのは「大丈夫」、配るのは「笑顔」。
            </p>
            <span className="mt-0.5 inline-flex items-center justify-center" style={{ gap: 7 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/waraeru-archangel.png"
                alt=""
                className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
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
            {session.profile?.avatar_url ? (
              <Link href={`/u/${session.userId}`} className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={session.profile.avatar_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 rounded-full object-cover"
                  style={{ boxShadow: "0 0 0 2px #c94d3a" }}
                />
              </Link>
            ) : session.profile ? (
              <Link
                href={`/u/${session.userId}`}
                className="flex h-9 w-9 items-center justify-center rounded-full font-bold text-white no-underline"
                style={{ background: "#c94d3a" }}
              >
                {session.profile.display_name.charAt(0)}
              </Link>
            ) : (
              <button
                className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: "#c94d3a" }}
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
        {/* 本日の出せる物資一覧 */}
        <FeaturedGoods offers={offers} />

        {/* オレンジ軍団 */}
        <OrangeCorps />

        {/* 物資登録CTA（楽市楽座の出品CTAを移植） */}
        <button
          className="block w-full text-left"
          onClick={() => {
            setTab("offers");
            if (!session.userId) requireJoin();
            else setGoodsSignal((n) => n + 1);
          }}
        >
          <div
            className="flex items-center gap-2.5 rounded-xl px-3 py-3 shadow-md"
            style={{ background: "linear-gradient(120deg,#c94d3a,#a03020)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/waraeru-archangel.png"
              alt=""
              className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-extrabold leading-tight text-white">
                出せる物資を登録する
              </div>
              <div className="text-[10.5px] leading-tight text-white/85">
                体に優しい食材を現地の炊き出しへ。写真つきでトップに載ります
              </div>
            </div>
            <div
              className="flex-shrink-0 rounded-full bg-white px-2.5 py-1 text-[12px] font-extrabold"
              style={{ color: "#c94d3a" }}
            >
              登録する →
            </div>
          </div>
        </button>

        {/* 3タブ切り替え（楽市/楽座/この指とまれ の移植） */}
        <div className="grid grid-cols-3 gap-1 rounded-2xl border border-[#ede5d8] bg-[#f5efe2] p-1">
          {TABS.map(([id, label, sub]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="rounded-xl py-2 text-center transition-colors"
              style={
                tab === id
                  ? { background: "#c94d3a", color: "#fff", boxShadow: "0 2px 8px rgba(201,77,58,.35)" }
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
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-[#8a8070]">
                現地の「欲しい物・やって欲しい事」。TalKのグループトークと同期しています
              </p>
              <Link href="/voice" className="shrink-0 text-[11px] font-bold underline" style={{ color: "#c94d3a" }}>
                全画面で見る
              </Link>
            </div>
            <GroupFeed
              scope="voice"
              userId={session.userId}
              requireJoin={requireJoin}
              placeholder="欲しい物・やって欲しい事を書く"
            />
          </div>
        )}

        {tab === "offers" && (
          <OffersSection
            userId={session.userId}
            isAdmin={session.isAdmin}
            requireJoin={requireJoin}
            openGoodsSignal={goodsSignal}
          />
        )}

        {tab === "board" && (
          <GroupFeed
            scope="board"
            userId={session.userId}
            requireJoin={requireJoin}
            placeholder="メッセージを書く"
          />
        )}

        {session.isAdmin && session.userId && <AdminSection userId={session.userId} />}

        <footer className="py-6 text-center text-sm text-[#8a8070]">
          <p className="mb-1 font-bold">📱 アプリのように使えます</p>
          <p className="text-xs">
            iPhone: 共有ボタン →「ホーム画面に追加」 / Android: メニュー →「ホーム画面に追加」
          </p>
          <p className="mt-4 text-xs text-[#b8b0a0]">わらわ〜ボランティア 熊本</p>
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

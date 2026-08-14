"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/useSession";
import { upsertMyProfile } from "@/lib/db";
import { JoinDialog } from "@/components/JoinDialog";
import { NeedsSection } from "@/components/NeedsSection";
import { OffersSection } from "@/components/OffersSection";
import { BoardSection } from "@/components/BoardSection";
import { MembersSection } from "@/components/MembersSection";

const TEMPLE_ADDRESS = "熊本県八代郡氷川町宮原598-1";
const MAP_URL =
  "https://www.google.com/maps/search/?api=1&query=" +
  encodeURIComponent(`西福寺 ${TEMPLE_ADDRESS}`);

export default function Home() {
  const session = useSession();
  const [showJoin, setShowJoin] = useState(false);

  // メールMagic Linkで戻ってきた人: 参加時に入れた名前でプロフィールを作る
  useEffect(() => {
    if (session.userId && !session.profile && !session.loading) {
      let pending = "";
      try {
        pending = localStorage.getItem("warawa-pending-name") ?? "";
      } catch {}
      if (pending) {
        upsertMyProfile(session.userId, pending).then(() => {
          try {
            localStorage.removeItem("warawa-pending-name");
          } catch {}
          session.refresh();
        });
      } else {
        setShowJoin(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.userId, session.profile, session.loading]);

  const requireJoin = () => setShowJoin(true);

  return (
    <main className="pb-16">
      {/* ヒーロー */}
      <header className="bg-[#d96c2c] text-white px-5 pt-10 pb-8 rounded-b-3xl">
        <p className="text-sm opacity-90">熊本地震 被災地支援</p>
        <h1 className="text-3xl font-bold mt-1 leading-tight">
          わらわ〜
          <br />
          ボランティア
        </h1>
        <p className="mt-3 text-sm leading-relaxed opacity-95">
          出せるものを、出せる人が、出せるだけ。
          <br />
          お金・体・物資 — 三つの支援を持ち寄って、現地を支えます。
        </p>
        <div className="mt-4 rounded-xl bg-white/15 p-3 text-sm">
          <p className="font-bold">🏠 受け入れ先: 西福寺（さいふくじ）</p>
          <p className="mt-1">{TEMPLE_ADDRESS}</p>
          <a
            href={MAP_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-2 rounded-lg bg-white text-[#d96c2c] px-3 py-1.5 font-bold"
          >
            📍 地図を開く
          </a>
        </div>
        {session.profile ? (
          <p className="mt-4 text-sm">
            ようこそ、<b>{session.profile.display_name}</b> さん
          </p>
        ) : (
          <button
            className="mt-4 w-full rounded-xl bg-white py-3 text-[#d96c2c] font-bold text-lg shadow"
            onClick={requireJoin}
          >
            参加する（無料・30秒）
          </button>
        )}
      </header>

      <NeedsSection userId={session.userId} isAdmin={session.isAdmin} />
      <OffersSection userId={session.userId} requireJoin={requireJoin} />
      <BoardSection userId={session.userId} requireJoin={requireJoin} />
      <MembersSection userId={session.userId} requireJoin={requireJoin} />

      {/* フッター: PWA案内 */}
      <footer className="px-5 py-8 text-center text-sm text-gray-600">
        <p className="font-bold mb-2">📱 アプリのように使えます</p>
        <p>
          iPhone: 共有ボタン →「ホーム画面に追加」
          <br />
          Android: メニュー →「ホーム画面に追加」
        </p>
        <p className="mt-6 text-xs text-gray-400">わらわ〜ボランティア 熊本</p>
      </footer>

      {showJoin && (
        <JoinDialog
          onClose={() => setShowJoin(false)}
          onJoined={() => session.refresh()}
        />
      )}
    </main>
  );
}

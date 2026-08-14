"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { upsertMyProfile } from "@/lib/db";
import { JoinDialog } from "@/components/JoinDialog";
import { NeedsSection } from "@/components/NeedsSection";
import { OffersSection } from "@/components/OffersSection";
import { BoardSection } from "@/components/BoardSection";
import { MembersSection } from "@/components/MembersSection";
import { AdminSection } from "@/components/AdminSection";
import { BottomNav } from "@/components/BottomNav";

const TEMPLE_ADDRESS = "熊本県八代郡氷川町宮原598-1";
const MAP_URL =
  "https://www.google.com/maps/search/?api=1&query=" +
  encodeURIComponent(`西福寺 ${TEMPLE_ADDRESS}`);

export default function Home() {
  const session = useSession();
  const [showJoin, setShowJoin] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");

  // Googleログイン直後: Googleの名前とアイコンでプロフィールを自動作成
  useEffect(() => {
    if (session.loading || !session.userId || session.profile) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }: { data: { user: User | null } }) => {
      const user = data.user;
      if (!user) return;
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const name =
        (meta.full_name as string) || (meta.name as string) || "参加者";
      const avatar = (meta.picture as string) || (meta.avatar_url as string) || null;
      await supabase
        .from("profiles")
        .upsert({ id: user.id, display_name: name, avatar_url: avatar });
      session.refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.userId, session.profile, session.loading]);

  const requireJoin = () => setShowJoin(true);

  const saveRename = async () => {
    if (!session.userId || !newName.trim()) return;
    await upsertMyProfile(session.userId, newName.trim());
    setRenaming(false);
    session.refresh();
  };

  return (
    <main className="pb-20">
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
            ようこそ、<b>{session.profile.display_name}</b> さん{" "}
            <button
              className="underline opacity-80"
              onClick={() => {
                setNewName(session.profile?.display_name ?? "");
                setRenaming(true);
              }}
            >
              名前を変える
            </button>
          </p>
        ) : (
          <button
            className="mt-4 w-full rounded-xl bg-white py-3 text-[#d96c2c] font-bold text-lg shadow"
            onClick={requireJoin}
          >
            Googleでログインして参加
          </button>
        )}
      </header>

      <NeedsSection userId={session.userId} isAdmin={session.isAdmin} />
      <OffersSection userId={session.userId} requireJoin={requireJoin} />
      <BoardSection userId={session.userId} requireJoin={requireJoin} />
      <MembersSection userId={session.userId} requireJoin={requireJoin} />
      {session.isAdmin && session.userId && (
        <AdminSection userId={session.userId} />
      )}

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

      {showJoin && <JoinDialog onClose={() => setShowJoin(false)} />}

      {renaming && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setRenaming(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-3">表示名を変える</h3>
            <input
              className="w-full rounded-xl border border-gray-300 px-3 py-2 mb-3"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={30}
            />
            <button
              className="w-full rounded-xl bg-[#3a7d44] py-3 text-white font-bold disabled:opacity-50"
              disabled={!newName.trim()}
              onClick={saveRename}
            >
              保存する
            </button>
          </div>
        </div>
      )}

      <BottomNav userId={session.userId} active="home" />
    </main>
  );
}

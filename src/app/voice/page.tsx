"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/useSession";
import { GroupFeed } from "@/components/GroupFeed";
import { JoinDialog } from "@/components/JoinDialog";
import { BottomNav } from "@/components/BottomNav";

/** 現地からの声（欲しい物・やって欲しい事）— グループTalKと同期した掲示板ビュー */
export default function VoicePage() {
  const session = useSession();
  const [showJoin, setShowJoin] = useState(false);

  return (
    <main className="min-h-screen pb-24" style={{ background: "#faf6ee" }}>
      <header className="sticky top-0 z-40 border-b border-[#ede5d8] bg-white/95 backdrop-blur-sm">
        <div className="flex h-[52px] items-center gap-3 px-4">
          <Link href="/" className="text-xl no-underline" style={{ color: "#d96a1a" }} aria-label="戻る">
            ←
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/waraeru-archangel.png" alt="" className="h-8 w-8 object-contain" />
          <div className="min-w-0">
            <h1 className="truncate text-[16px] font-bold leading-tight" style={{ color: "#d96a1a" }}>
              現地からの声
            </h1>
            <p className="text-[10px] leading-tight text-[#8a8070]">
              欲しい物・やって欲しい事（TalKと同期）
            </p>
          </div>
          <Link
            href="/talk/g/voice"
            className="ml-auto shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold text-white no-underline"
            style={{ background: "#d96a1a" }}
          >
            💬 Talk表示
          </Link>
        </div>
      </header>

      <div className="px-4 pt-3">
        <GroupFeed
          scope="voice"
          userId={session.userId}
          requireJoin={() => setShowJoin(true)}
          placeholder="欲しい物・やって欲しい事を書く"
        />
      </div>

      {showJoin && <JoinDialog onClose={() => setShowJoin(false)} />}
      <BottomNav userId={session.userId} active="home" requireJoin={() => setShowJoin(true)} />
    </main>
  );
}

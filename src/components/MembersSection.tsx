"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMembers, getOrCreateChat, type Profile } from "@/lib/db";
import { Avatar } from "@/components/Avatar";

/** 参加者一覧。タップで1対1Talkへ */
export function MembersSection({
  userId,
  requireJoin,
}: {
  userId: string | null;
  requireJoin: () => void;
}) {
  const [members, setMembers] = useState<Profile[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchMembers().then(setMembers);
  }, [userId]);

  const openTalk = async (other: Profile) => {
    if (!userId) {
      requireJoin();
      return;
    }
    if (other.id === userId) return;
    const chatId = await getOrCreateChat(userId, other.id);
    if (chatId) router.push(`/talk/${chatId}`);
  };

  return (
    <section className="px-4 py-6 bg-[#f3ecdd]" id="members">
      <h2 className="text-xl font-bold mb-1">👥 参加者 {members.length}人</h2>
      <p className="text-sm text-gray-600 mb-4">
        タップすると1対1のTalkができます
      </p>
      <div className="flex flex-wrap gap-3">
        {members.map((m) => (
          <button
            key={m.id}
            className="flex flex-col items-center w-16 active:scale-95 transition-transform"
            onClick={() => openTalk(m)}
          >
            <Avatar name={m.display_name} url={m.avatar_url} size={48} />
            <span className="text-xs mt-1 truncate w-full text-center">
              {m.display_name || "参加者"}
              {m.id === userId ? "（私）" : ""}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

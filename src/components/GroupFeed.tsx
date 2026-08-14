"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchBoard,
  fetchBoardSince,
  markGroupRead,
  type BoardMessage,
  type BoardScope,
} from "@/lib/db";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { PostComposer } from "@/components/PostComposer";
import { EmbedCard, type OGPEmbed } from "@/components/EmbedCard";

/* eslint-disable @next/next/no-img-element */

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * グループ掲示板フィード。同じデータがTalKタブのグループトークにも出る（同期方式）。
 * voice(助けて)は「まず何県の何市か」を聴く連動セレクトつきのCotoZute型投稿欄。
 * voiceのフィードは匿名的なシンプル表示: 「📍○○県○○市」+ 欲しい物、をずらっと並べる（名前・アイコンなし）。
 */
export function GroupFeed({
  scope,
  userId,
  myAvatar = null,
  requireJoin,
  placeholder,
}: {
  scope: BoardScope;
  userId: string | null;
  myAvatar?: string | null;
  requireJoin: () => void;
  placeholder: string;
}) {
  const [messages, setMessages] = useState<BoardMessage[]>([]);
  const cursorRef = useRef<string | null>(null);

  const pull = async () => {
    const fresh = await fetchBoardSince(scope, cursorRef.current ?? "1970-01-01");
    if (fresh.length) {
      cursorRef.current = fresh[fresh.length - 1].created_at;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
      });
    }
  };

  useEffect(() => {
    let alive = true;
    fetchBoard(scope).then((rows) => {
      if (!alive) return;
      setMessages(rows);
      if (rows.length) cursorRef.current = rows[rows.length - 1].created_at;
      if (userId) markGroupRead(scope, userId);
    });
    const timer = setInterval(async () => {
      if (document.hidden || !cursorRef.current) return;
      await pull();
      if (userId) markGroupRead(scope, userId);
    }, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, userId]);

  return (
    <div>
      <PostComposer
        scope={scope}
        prompt={placeholder}
        withLocation={scope === "voice"}
        userId={userId}
        myAvatar={myAvatar}
        requireJoin={requireJoin}
        onPosted={pull}
      />

      <div className="space-y-2">
        {messages.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#e0d6c6] bg-white py-8 text-center text-sm text-[#a09888]">
            まだ書き込みがありません
          </p>
        )}
        {[...messages].reverse().map((m) => {
          const images = m.image_urls?.length
            ? m.image_urls
            : m.image_url
              ? [m.image_url]
              : [];
          const thumbs = m.thumb_urls?.length ? m.thumb_urls : images;

          // 助けて(voice): 名前・アイコンなしのシンプル行「📍○○県○○市 ＋ 欲しい物」
          if (scope === "voice") {
            return (
              <div
                key={m.id}
                className="rounded-xl border border-[#ede5d8] bg-white px-3 py-2.5 shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  {m.profiles?.avatar_url ? (
                    <img
                      src={m.profiles.avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                      style={{ background: "#c05e14" }}
                    >
                      現地
                    </span>
                  )}
                  <span className="min-w-0 flex-1 text-[15.5px] font-extrabold leading-tight" style={{ color: "#c05e14" }}>
                    {m.pref ?? ""}{m.city ? ` ${m.city}` : ""}からの投稿
                  </span>
                  <span className="shrink-0 self-start text-[10px] text-[#c0b8a8]">
                    {fmtTime(m.created_at)}
                  </span>
                </div>
                {m.body && (
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-[14.5px] font-bold leading-relaxed text-[#3a3428]">
                    {m.body}
                  </p>
                )}
                {m.embed && (
                  <div className="mt-2">
                    <EmbedCard embed={m.embed as OGPEmbed} />
                  </div>
                )}
                {images.map((full, i) => (
                  <img
                    key={full}
                    src={thumbs[i] ?? full}
                    alt=""
                    className="mt-2 w-full rounded-lg object-cover"
                  />
                ))}
              </div>
            );
          }

          // それ以外: 従来のカード（アバター+名前）
          return (
            <div
              key={m.id}
              className="rounded-xl border border-[#ede5d8] p-3 shadow-sm"
              style={{ background: "linear-gradient(180deg,#fffaf0,#fdf6e9)" }}
            >
              <div className="flex items-center gap-2">
                <Avatar
                  name={m.profiles?.display_name ?? "参加者"}
                  url={m.profiles?.avatar_url}
                  size={30}
                />
                <span className="flex items-center gap-1 text-[12.5px] font-bold text-[#3a3428]">
                  {m.profiles?.display_name ?? "参加者"}
                  <VerifiedBadge size={13} />
                </span>
                <span className="ml-auto text-[10px] text-[#a09888]">{fmtTime(m.created_at)}</span>
              </div>
              {m.body && (
                <p className="mt-1.5 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-[#4a4438]">
                  {m.body}
                </p>
              )}
              {m.embed && (
                <div className="mt-2">
                  <EmbedCard embed={m.embed as OGPEmbed} />
                </div>
              )}
              {images.map((full, i) => (
                <img
                  key={full}
                  src={thumbs[i] ?? full}
                  alt=""
                  className="mt-2 w-full rounded-lg object-cover"
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

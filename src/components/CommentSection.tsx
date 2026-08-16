"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addComment, fetchComments, type FeedComment } from "@/lib/db";
import { Linkify } from "@/components/Linkify";

/* eslint-disable @next/next/no-img-element */

function relTime(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "たった今";
  if (s < 3600) return `${Math.floor(s / 60)}分前`;
  if (s < 86400) return `${Math.floor(s / 3600)}時間前`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}日前`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * フィード内コメント欄（OneSea CotoZuteと同じ: 本編を開かず、その場で読み書き）。
 * アバターはマイページへのリンク。「何が欲しい」投稿に「私は出せます」と返し、
 * あとはマイページの「連絡を取る」からTalKで直接やり取りできる。
 */
export function CommentSection({
  itemKey,
  userId,
  requireJoin,
  onAdded,
}: {
  itemKey: string;
  userId: string | null;
  requireJoin: () => void;
  onAdded?: () => void;
}) {
  const [list, setList] = useState<FeedComment[] | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchComments(itemKey).then(setList);
  }, [itemKey]);

  const submit = async () => {
    if (!userId) {
      requireJoin();
      return;
    }
    if (!body.trim() || sending) return;
    setSending(true);
    const { error } = await addComment(itemKey, userId, body.trim());
    setSending(false);
    if (!error) {
      setBody("");
      setList(await fetchComments(itemKey));
      onAdded?.();
    }
  };

  return (
    <div className="mt-2 rounded-2xl bg-[#f5f6f8] px-3 pb-2.5 pt-2">
      {list === null ? (
        <div className="flex justify-center py-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#c8ccd1] border-t-transparent" />
        </div>
      ) : list.length === 0 ? (
        <p className="py-1.5 text-[12px] text-[#9aa0a6]">まだコメントはありません</p>
      ) : (
        list.map((c) => (
          <div key={c.id} className="flex gap-2 py-1.5">
            <Link
              href={`/u/${c.user_id}`}
              className="mt-0.5 h-[26px] w-[26px] flex-shrink-0 overflow-hidden rounded-full"
            >
              {c.profiles?.avatar_url ? (
                <img
                  src={c.profiles.avatar_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center"
                  style={{ background: "linear-gradient(140deg,#fad8a8,#f0b060)" }}
                >
                  <img src="/icons/icon-leaf.webp" alt="" style={{ width: 12, height: 12 }} />
                </span>
              )}
            </Link>
            <div className="min-w-0 flex-1 rounded-xl bg-white px-2.5 py-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Link
                  href={`/u/${c.user_id}`}
                  className="truncate text-[11.5px] font-bold text-[#1c1e21] no-underline"
                >
                  {c.profiles?.display_name ?? "参加者"}
                </Link>
                <span className="num flex-shrink-0 text-[10px] text-[#b0b3b8]">
                  {relTime(c.created_at)}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#33363a]"><Linkify text={c.body} /></p>
            </div>
          </div>
        ))
      )}
      {userId ? (
        <div className="mt-1.5 flex items-end gap-1.5">
          <div className="relative min-h-[38px] flex-1">
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              rows={1}
              className="min-h-[38px] w-full resize-none rounded-2xl border border-[#dcdfe4] bg-white px-3.5 py-2 text-[13.5px] leading-snug outline-none focus:border-[#d96a1a]"
            />
            {!body && (
              <span className="pointer-events-none absolute left-3.5 top-2 text-[13.5px] text-[#9aa0a6]">
                コメントして応援する<span className="caret-blink" aria-hidden />
              </span>
            )}
          </div>
          <button
            onClick={submit}
            disabled={!body.trim() || sending}
            aria-label="コメントを送信"
            className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full text-white disabled:opacity-35"
            style={{ background: "#d96a1a" }}
          >
            {sending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.7 3.3 4.1 10c-.9.4-.8 1.6.1 1.9l6 2 2 5.9c.3.9 1.6 1 1.9.1l6.7-16.6z" />
                <path d="M20.7 3.3 10.2 13.9" />
              </svg>
            )}
          </button>
        </div>
      ) : (
        <button className="pt-1 text-[11.5px] text-[#9aa0a6] underline" onClick={requireJoin}>
          コメントするにはログインしてください
        </button>
      )}
    </div>
  );
}

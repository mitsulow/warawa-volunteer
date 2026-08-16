"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  deleteBoardMessage,
  fetchBoard,
  fetchBoardSince,
  fetchCommentCounts,
  fetchFeedLikes,
  fetchLikersFor,
  type Liker,
  markGroupRead,
  toggleFeedLike,
  type BoardMessage,
  type BoardScope,
} from "@/lib/db";
import { CommentSection } from "@/components/CommentSection";
import { Linkify } from "@/components/Linkify";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { PostComposer } from "@/components/PostComposer";
import { EmbedCard, type OGPEmbed } from "@/components/EmbedCard";
import { DotsMenu } from "@/components/PostKit";
import { ReportDialog } from "@/components/ReportDialog";
import { KYUSHU_PREFS, PREF_ORDER, fetchMunicipalities } from "@/lib/prefs";

/* eslint-disable @next/next/no-img-element */

/* CotoZuteと同じアイコン文法（ハート白抜き→赤 / 吹き出し） */
function IcoHeart({ on }: { on: boolean }) {
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill={on ? "#e8384f" : "none"} stroke={on ? "#e8384f" : "#d96a1a"} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "fill .12s, stroke .12s" }}>
      <path d="M12 20.4C7 17.2 3.4 13.9 3.4 9.8c0-2.7 2.1-4.7 4.6-4.7 1.7 0 3.3 1 4 2.5.7-1.5 2.3-2.5 4-2.5 2.5 0 4.6 2 4.6 4.7 0 4.1-3.6 7.4-8.6 10.6z" />
    </svg>
  );
}
function IcoBubble() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d96a1a" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4.4c4.8 0 8.3 2.9 8.3 6.8s-3.5 6.8-8.3 6.8c-.9 0-1.7-.1-2.5-.3l-3.9 1.8 1-3.4c-1.8-1.2-2.9-3-2.9-4.9 0-3.9 3.5-6.8 8.3-6.8z" />
    </svg>
  );
}

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
  isAdmin = false,
  requireJoin,
  placeholder,
}: {
  scope: BoardScope;
  userId: string | null;
  myAvatar?: string | null;
  isAdmin?: boolean;
  requireJoin: () => void;
  placeholder: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<BoardMessage[]>([]);
  const [report, setReport] = useState<{ key: string; excerpt: string } | null>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; idx: number } | null>(null);
  const [likeCounts, setLikeCounts] = useState<Map<string, number>>(new Map());
  const [likers, setLikers] = useState<Record<string, Liker[]>>({});
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [commentCounts, setCommentCounts] = useState<Map<string, number>>(new Map());
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [expandedBody, setExpandedBody] = useState<Set<string>>(new Set());
  const needsFold = (b: string) => b.length > 60 || b.includes("\n");
  // エリア絞り込み（助けて）: どこの県・市で困っているかをセクション分けで確認できる
  const [fPref, setFPref] = useState("九州全域");
  const [fCity, setFCity] = useState("全市町村");
  const [composerOpen, setComposerOpen] = useState(false);
  const [cityMap, setCityMap] = useState<Record<string, string[]>>({});
  const cursorRef = useRef<string | null>(null);

  useEffect(() => {
    if (scope === "voice") fetchMunicipalities().then(setCityMap);
  }, [scope]);

  const matchArea = (m: BoardMessage): boolean => {
    if (scope !== "voice") return true;
    if (fPref === "九州全域") {
      return !m.pref || KYUSHU_PREFS.includes(m.pref);
    }
    if (m.pref !== fPref) return false;
    if (fCity === "全域" || fCity === "全市町村") return true;
    return m.city === fCity;
  };

  // いいね・コメント数の読み込み（CotoZuteと同じ仕組み）
  useEffect(() => {
    const keys = messages.map((m) => `board:${m.id}`).slice(0, 100);
    if (keys.length === 0) return;
    fetchFeedLikes(keys, userId).then(({ counts, mine }) => {
      setLikeCounts(counts);
      setMyLikes(mine);
    });
    fetchLikersFor(keys).then(setLikers);
    fetchCommentCounts(keys).then(setCommentCounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, userId]);

  const like = async (key: string) => {
    if (!userId) {
      requireJoin();
      return;
    }
    const on = !myLikes.has(key);
    setMyLikes((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
    setLikeCounts((prev) => {
      const next = new Map(prev);
      next.set(key, Math.max(0, (next.get(key) ?? 0) + (on ? 1 : -1)));
      return next;
    });
    await toggleFeedLike(key, userId, on);
    // いいねした人の顔をその記事だけ取り直す
    fetchLikersFor([key]).then((m) =>
      setLikers((prev) => ({ ...prev, [key]: m[key] ?? [] }))
    );
  };

  const toggleComments = (key: string) => {
    setOpenComments((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const removeMessage = async (id: string) => {
    if (!window.confirm("この投稿を削除しますか？")) return;
    await deleteBoardMessage(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

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
    }, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, userId]);

  return (
    <div>
      {scope === "voice" && !composerOpen && (
        <div className="mb-2">
          <p className="mb-1 text-[13px] font-bold text-[#5a5448]">助けて欲しい場所</p>
          <div className="flex gap-2">
            <select
              value={fPref}
              onChange={(e) => {
                setFPref(e.target.value);
                setFCity(e.target.value === "九州全域" ? "全市町村" : "全域");
              }}
              className="w-[42%] rounded-xl border border-[#e8dcc4] bg-white px-2 py-2 text-[13.5px] outline-none focus:border-[#d96a1a]"
            >
              <option value="九州全域">九州全域</option>
              {PREF_ORDER.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={fCity}
              onChange={(e) => setFCity(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-[#e8dcc4] bg-white px-2 py-2 text-[13.5px] outline-none focus:border-[#d96a1a]"
            >
              {fPref === "九州全域" ? (
                <option value="全市町村">全市町村</option>
              ) : (
                <>
                  <option value="全域">全域</option>
                  {(cityMap[fPref] ?? []).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>
      )}

      <PostComposer
        scope={scope}
        prompt={placeholder}
        withLocation={scope === "voice"}
        photoHint={
          scope === "voice"
            ? "「こんなイメージです」という写真があれば添付してください"
            : undefined
        }
        userId={userId}
        myAvatar={myAvatar}
        requireJoin={requireJoin}
        onPosted={pull}
        onExpandedChange={setComposerOpen}
        examplePlaceholder={
          scope === "voice"
            ? "ナチュラルな発酵食品が食べたい/マッサージをして欲しい/不安なので九州を出てプチ贅沢な温泉旅行に行きたい/など、どんな要望でも良いので遠慮せずにお書きください。"
            : undefined
        }
      />

      <div>
        {messages.filter(matchArea).length === 0 && (
          <p className="rounded-xl border border-dashed border-[#e0d6c6] bg-white py-8 text-center text-sm text-[#a09888]">
            {scope === "voice" ? "このエリアの投稿はまだありません" : "まだ書き込みがありません"}
          </p>
        )}
        {[...messages].filter(matchArea).reverse().map((m) => {
          const images = m.image_urls?.length
            ? m.image_urls
            : m.image_url
              ? [m.image_url]
              : [];
          const thumbs = m.thumb_urls?.length ? m.thumb_urls : images;

          // 助けて(voice): 名前・アイコンなしのシンプル行「📍○○県○○市 ＋ 欲しい物」
          if (scope === "voice") {
            return (
              /* mond式カード: 色枠 + 白カード + 透かしワラエル + 手書きロゴ */
              <div
                key={m.id}
                className="-mx-2 border-b border-[#f0ece0] bg-white"
              >
              <div className="relative overflow-hidden px-3 py-2.5">
                <div className="relative">
                <div className="flex items-center gap-2.5">
                  {/* アイコンはマイページへ（助けてもGoogle認証必須になったので投稿者が分かる） */}
                  <Link href={`/u/${m.user_id}`} className="flex-shrink-0" aria-label="投稿者のマイページ">
                    {m.profiles?.avatar_url ? (
                      <img
                        src={m.profiles.avatar_url}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                        style={{ background: "#c05e14" }}
                      >
                        現地
                      </span>
                    )}
                  </Link>
                  <span className="min-w-0 flex-1 text-[15.5px] font-extrabold leading-tight" style={{ color: "#c05e14" }}>
                    {m.pref ?? ""}{m.city && m.city !== "市は不明" ? ` ${m.city}` : ""}からの投稿
                  </span>
                  <span className="shrink-0 self-start text-[10px] text-[#c0b8a8]">
                    {fmtTime(m.created_at)}
                  </span>
                  {userId && (
                    <DotsMenu
                      canEdit={userId === m.user_id || isAdmin}
                      onEdit={() => router.push(`/post/board/${m.id}?edit=1`)}
                      onDelete={() => removeMessage(m.id)}
                      onReport={() => setReport({ key: `board:${m.id}`, excerpt: m.body })}
                    />
                  )}
                </div>
                {m.body && (
                  <div className="mt-1.5">
                    <p
                      className={`whitespace-pre-wrap break-words text-[16px] leading-relaxed text-[#3a3428] ${
                        expandedBody.has(`board:${m.id}`) || !needsFold(m.body) ? "" : "line-clamp-1"
                      }`}
                      onClick={() => {
                        if (needsFold(m.body) && !expandedBody.has(`board:${m.id}`))
                          setExpandedBody((p) => new Set(p).add(`board:${m.id}`));
                      }}
                    >
                      <Linkify text={m.body} />
                    </p>
                    {needsFold(m.body) && !expandedBody.has(`board:${m.id}`) && (
                      <button
                        onClick={() => setExpandedBody((p) => new Set(p).add(`board:${m.id}`))}
                        className="text-[13.5px] text-[#8a8d91]"
                      >
                        …もっと見る
                      </button>
                    )}
                    {needsFold(m.body) && expandedBody.has(`board:${m.id}`) && (
                      <button
                        onClick={() =>
                          setExpandedBody((p) => {
                            const n = new Set(p);
                            n.delete(`board:${m.id}`);
                            return n;
                          })
                        }
                        className="mt-1 text-[13.5px] text-[#8a8d91]"
                      >
                        △ 折りたたむ
                      </button>
                    )}
                  </div>
                )}
                {m.embed && (
                  <div className="mt-2">
                    <EmbedCard embed={m.embed as OGPEmbed} />
                  </div>
                )}
                {images.length > 0 && (
                  <PhotoCarousel
                    className="-mx-3 mt-2"
                    images={images}
                    thumbs={thumbs}
                    onOpen={(i) => setLightbox({ urls: images, idx: i })}
                  />
                )}
                {/* いいね+コメント（CotoZuteと同じ。「私は出せます」と返して、あとはTalKで） */}
                <div className="mt-2 flex items-center gap-4">
                  <button className="flex items-center gap-1" onClick={() => like(`board:${m.id}`)} aria-label="いいね">
                    <IcoHeart on={myLikes.has(`board:${m.id}`)} />
                    {(likeCounts.get(`board:${m.id}`) ?? 0) > 0 && (
                      <span className="num text-[12px] font-bold text-[#8a8070]">
                        {likeCounts.get(`board:${m.id}`)}
                      </span>
                    )}
                  </button>
                  <button className="flex items-center gap-1" onClick={() => toggleComments(`board:${m.id}`)} aria-label="コメント">
                    <IcoBubble />
                    {(commentCounts.get(`board:${m.id}`) ?? 0) > 0 && (
                      <span className="num text-[12px] font-bold text-[#8a8070]">
                        {commentCounts.get(`board:${m.id}`)}
                      </span>
                    )}
                  </button>
                </div>


                {/* いいねした人の顔（CotoZuteのFB風・ハートの下） */}
                {(likers[`board:${m.id}`]?.length ?? 0) > 0 && (
                  <div className="mt-1 flex items-center">
                    {likers[`board:${m.id}`].map((l, i) => (
                      <span key={i} style={{ marginLeft: i === 0 ? 0 : -6 }}>
                        {l.avatar_url ? (
                          <img src={l.avatar_url} alt="" referrerPolicy="no-referrer" className="h-[20px] w-[20px] rounded-full border-2 border-white object-cover" />
                        ) : (
                          <span className="flex h-[20px] w-[20px] items-center justify-center rounded-full border-2 border-white bg-[#fdeedd]">
                            <img src="/icons/icon-leaf.webp" alt="" style={{ width: 12, height: 12 }} />
                          </span>
                        )}
                      </span>
                    ))}
                    <span className="ml-1.5 text-[11px] text-[#8a8d91]">
                      {likers[`board:${m.id}`][0]?.display_name ?? ""}
                      {(likeCounts.get(`board:${m.id}`) ?? 0) > 1 ? ` 他${(likeCounts.get(`board:${m.id}`) ?? 0) - 1}人` : ""}
                    </span>
                  </div>
                )}
                {openComments.has(`board:${m.id}`) && (
                  <CommentSection
                    itemKey={`board:${m.id}`}
                    userId={userId}
                    requireJoin={requireJoin}
                    onAdded={() =>
                      setCommentCounts((prev) => {
                        const next = new Map(prev);
                        const k = `board:${m.id}`;
                        next.set(k, (next.get(k) ?? 0) + 1);
                        return next;
                      })
                    }
                  />
                )}
                </div>
                {/* 透かしワラエル: 少し左に倒してナナメ。写真がある時は写真の上に重なる(mondの猫と同じ) */}
                <img
                  src="/waraeru-v2.png"
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute h-[84px] w-[84px] object-contain"
                  style={{
                    opacity: 0.12,
                    bottom: -13,
                    right: -14,
                    transform: "rotate(-8deg)",
                  }}
                />
              </div>
              {/* 枠の外・右下に手書きロゴ */}
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
                <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#4a4438]">
                  <Linkify text={m.body} />
                </p>
              )}
              {m.embed && (
                <div className="mt-2">
                  <EmbedCard embed={m.embed as OGPEmbed} />
                </div>
              )}
              {images.length > 0 && (
                <PhotoCarousel className="mt-2 overflow-hidden rounded-lg" images={images} thumbs={thumbs} onOpen={(i) => setLightbox({ urls: images, idx: i })} />
              )}
            </div>
          );
        })}
      </div>

      {/* 通報（→事務局/officeの通報受信箱へ届く） */}
      {report && userId && (
        <ReportDialog
          itemKey={report.key}
          excerpt={report.excerpt}
          meId={userId}
          onClose={() => setReport(null)}
        />
      )}

      {/* ライトボックス（タップでフル画質） */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-3"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox.urls[lightbox.idx]} alt="" className="max-h-full max-w-full object-contain" />
          <button className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white" aria-label="閉じる">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

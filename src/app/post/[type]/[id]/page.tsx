"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/useSession";
import {
  deleteBoardMessage,
  deleteOffer,
  fetchBoardMessageById,
  fetchCommentCounts,
  fetchGoodsRequestCounts,
  fetchMyVoiceSupports,
  fetchVoiceSupportCounts,
  type VoiceSupport,
  fetchMyGoodsRequests,
  type GoodsRequest,
  fetchFeedLikes,
  fetchLikersFor,
  fetchOfferById,
  toggleFeedLike,
  updateBoardMessage,
  updateOfferDetail,
  type BoardMessage,
  type Liker,
  type Offer,
} from "@/lib/db";
import { uploadImagePair, type ImagePair } from "@/lib/images";
import { useCropQueue } from "@/components/ImageCropper";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { DotsMenu } from "@/components/PostKit";
import { ReportDialog } from "@/components/ReportDialog";
import { EmbedCard, type OGPEmbed } from "@/components/EmbedCard";
import { CommentSection } from "@/components/CommentSection";
import { Linkify } from "@/components/Linkify";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { GoodsSupportBlock } from "@/components/GoodsSupportBlock";
import { VoiceSupportBlock } from "@/components/VoiceSupportBlock";
import { Lightbox } from "@/components/Lightbox";
import { JoinDialog } from "@/components/JoinDialog";

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
 * 投稿の個別ページ（OneSea /post/[id] と同じ挙動）。
 * フィードの⋯→編集から ?edit=1 で来たら、修正ボタンを押した後の状態で開く。
 */
export default function PostPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = use(params);
  const isBoard = type === "board";
  const session = useSession();
  const router = useRouter();
  const [board, setBoard] = useState<BoardMessage | null | undefined>(undefined);
  const [offer, setOffer] = useState<Offer | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editImgs, setEditImgs] = useState<ImagePair[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const crop = useCropQueue(async (files) => {
    if (!session.userId) return;
    setUploading(true);
    const pairs: ImagePair[] = [];
    for (const f of files) {
      const p = await uploadImagePair(session.userId, f);
      if (p) pairs.push(p);
    }
    if (pairs.length) setEditImgs((prev) => [...prev, ...pairs].slice(0, 4));
    setUploading(false);
  });
  const [reportOpen, setReportOpen] = useState(false);
  const editStarted = useRef(false);
  // いいね・コメント（フィードと同じ挙動。通知から飛んで来た人がその場で読める）
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likers, setLikers] = useState<Liker[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [showJoin, setShowJoin] = useState(false);
  const itemKeyRef = `${type}:${id}`;
  const [lb, setLb] = useState<number | null>(null);
  const [supCount, setSupCount] = useState<{ pending: number; accepted: number } | undefined>(undefined);
  const [mySup, setMySup] = useState<VoiceSupport | null>(null);
  const [reqCount, setReqCount] = useState<{ pending: number; accepted: number } | undefined>(undefined);
  const [myReq, setMyReq] = useState<GoodsRequest | null>(null);
  const loadRequests = () => {
    if (isBoard) {
      fetchVoiceSupportCounts([id]).then((m) => setSupCount(m.get(id)));
      if (session.userId) fetchMyVoiceSupports(session.userId).then((rs) => setMySup(rs.find((r) => r.message_id === id) ?? null));
      return;
    }
    fetchGoodsRequestCounts([id]).then((m) => setReqCount(m.get(id)));
    if (session.userId) fetchMyGoodsRequests(session.userId).then((rs) => setMyReq(rs.find((r) => r.offer_id === id) ?? null));
  };
  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, session.userId]);

  useEffect(() => {
    fetchFeedLikes([itemKeyRef], session.userId).then(({ counts, mine }) => {
      setLikeCount(counts.get(itemKeyRef) ?? 0);
      setLiked(mine.has(itemKeyRef));
    });
    fetchLikersFor([itemKeyRef]).then((m) => setLikers(m[itemKeyRef] ?? []));
    fetchCommentCounts([itemKeyRef]).then((m) => setCommentCount(m.get(itemKeyRef) ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKeyRef, session.userId]);

  const like = async () => {
    if (!session.userId) {
      setShowJoin(true);
      return;
    }
    const on = !liked;
    setLiked(on);
    setLikeCount((n) => Math.max(0, n + (on ? 1 : -1)));
    await toggleFeedLike(itemKeyRef, session.userId, on);
    fetchLikersFor([itemKeyRef]).then((m) => setLikers(m[itemKeyRef] ?? []));
  };

  const load = async () => {
    if (isBoard) setBoard(await fetchBoardMessageById(id));
    else setOffer(await fetchOfferById(id));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id]);

  const item = isBoard ? board : offer;
  const loading = item === undefined || session.loading;
  const ownerId = isBoard ? board?.user_id : offer?.user_id;
  const canEdit = !!session.userId && (session.userId === ownerId || session.isAdmin);

  const startEdit = () => {
    if (!canEdit || !item) return;
    if (isBoard && board) {
      setDraft(board.body);
      const fulls = board.image_urls ?? (board.image_url ? [board.image_url] : []);
      const thumbs = board.thumb_urls ?? (board.image_url ? [board.image_url] : []);
      setEditImgs(fulls.map((f, i) => ({ full: f, thumb: thumbs[i] ?? f })));
    } else if (offer) {
      setDraft(offer.detail);
      const fulls = offer.image_urls ?? (offer.image_url ? [offer.image_url] : []);
      const thumbs = offer.thumb_urls ?? (offer.image_url ? [offer.image_url] : []);
      setEditImgs(fulls.map((f, i) => ({ full: f, thumb: thumbs[i] ?? f })));
    }
    setEditing(true);
  };

  /* フィードの⋯→編集から ?edit=1 で来たら編集状態で開く（OneSeaと同じ） */
  useEffect(() => {
    if (loading || !item || editing || editStarted.current || !canEdit) return;
    if (!new URLSearchParams(window.location.search).get("edit")) return;
    editStarted.current = true;
    startEdit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, item, canEdit]);

  const save = async () => {
    if (saving || !draft.trim()) return;
    setSaving(true);
    if (isBoard) {
      await updateBoardMessage(
        id,
        draft.trim(),
        editImgs.map((i) => i.full),
        editImgs.map((i) => i.thumb)
      );
    } else {
      await updateOfferDetail(
        id,
        draft.trim(),
        editImgs.map((i) => i.full),
        editImgs.map((i) => i.thumb)
      );
    }
    setSaving(false);
    setEditing(false);
    load();
  };

  const remove = async () => {
    if (!window.confirm("この投稿を削除しますか？")) return;
    if (isBoard) await deleteBoardMessage(id);
    else await deleteOffer(id);
    router.push("/");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={{ background: "#faf6ee" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d96a1a] border-t-transparent" />
      </main>
    );
  }

  if (!item) {
    return (
      <main className="min-h-screen p-6 text-center" style={{ background: "#faf6ee" }}>
        <p className="mt-10 text-sm text-[#8a8070]">この投稿は見つかりませんでした（削除された可能性があります）</p>
        <Link href="/" className="mt-4 inline-block font-bold underline" style={{ color: "#d96a1a" }}>
          ← ホームへもどる
        </Link>
      </main>
    );
  }

  const name = item.profiles?.display_name ?? "参加者";
  const avatar = item.profiles?.avatar_url ?? null;
  const memberNo = item.profiles?.member_no ?? null;
  const body = isBoard
    ? board!.body
    : offer!.kind === "goods" && offer!.title
      ? `${offer!.title}\n${offer!.detail}`
      : offer!.detail;
  const images = isBoard
    ? (board!.image_urls ?? (board!.image_url ? [board!.image_url] : []))
    : (offer!.image_urls ?? (offer!.image_url ? [offer!.image_url] : []));
  const itemKey = `${type}:${id}`;

  return (
    <main className="min-h-screen pb-16" style={{ background: "#faf6ee" }}>
      <header className="sticky top-0 z-30 border-b border-[#ede5d8] bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="relative flex items-center justify-center">
          <button
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
            className="absolute left-0 rounded-full border px-3 py-1 text-[12.5px] font-bold"
            style={{ color: "#d96a1a", borderColor: "#f0d0a8", background: "#fff" }}
          >
            戻る
          </button>
          <span className="text-[14px] font-bold text-[#1c1e21]">投稿</span>
        </div>
      </header>

      <div className="bg-white px-4 py-3">
        {/* ヘッダー */}
        <div className="flex items-center gap-2.5">
          <Link href={`/u/${ownerId}`} className="flex-shrink-0">
            <Avatar name={name} url={avatar} size={40} />
          </Link>
          <div className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-[14.5px] font-bold leading-tight text-[#1c1e21]">
              {name}
              <VerifiedBadge size={14} />
            </span>
            <div className="text-[11.5px] leading-tight text-[#8a8d91]">
              {relTime(item.created_at)}
              {memberNo != null && <span className="num ml-1.5">@わらわ〜ボランティアNo.{memberNo}</span>}
            </div>
          </div>
          {session.userId && (
            <DotsMenu
              canEdit={canEdit}
              onEdit={startEdit}
              onDelete={remove}
              onReport={() => setReportOpen(true)}
            />
          )}
        </div>

        {editing ? (
          <div className="mt-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              maxLength={500}
              autoFocus
              className="w-full resize-y rounded-xl border border-[#e8dcc4] bg-white p-3 text-[15px] leading-relaxed outline-none focus:border-[#d96a1a]"
            />
            {/* 画像の変更（OneSea同様・掲示板/物資/その他すべて対応） */}
            {(
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {editImgs.map((im, i) => (
                  <div key={im.thumb} className="relative">
                    <img src={im.thumb} alt="" className="h-16 w-16 rounded-lg object-cover" />
                    <button
                      onClick={() => setEditImgs(editImgs.filter((_, j) => j !== i))}
                      aria-label="画像を外す"
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] text-white"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {editImgs.length < 4 && (
                  <label className="flex h-16 cursor-pointer items-center rounded-lg border border-[#e8dcc4] bg-white px-4 text-[12.5px] font-bold text-[#8a7a5a]">
                    {uploading ? "⏳" : "📷 追加"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (!session.userId || !e.target.files?.length || uploading) return;
                        const files = Array.from(e.target.files).slice(0, 4 - editImgs.length);
                        e.target.value = "";
                        crop.start(files);
                      }}
                    />
                  </label>
                )}
              </div>
            )}
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => setEditing(false)}
                className="rounded-xl px-3 py-2 text-[12.5px] font-bold text-[#a09888]"
              >
                キャンセル
              </button>
              <button
                onClick={save}
                disabled={saving || uploading || !draft.trim()}
                className="rounded-xl px-5 py-2 text-[13px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#d96a1a" }}
              >
                {saving ? "保存中..." : "保存する"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {body.trim() && (
              <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#1c1e21]">
                <Linkify text={body} />
              </p>
            )}
            {isBoard && board!.embed && (
              <div className="mt-2">
                <EmbedCard embed={board!.embed as OGPEmbed} />
              </div>
            )}
            {images.length > 0 && (
              <PhotoCarousel
                className="-mx-4 mt-2"
                images={images}
                stamp={
                  (!isBoard && offer!.kind === "goods" && offer!.done) || (isBoard && board!.scope === "voice" && board!.status === "done")
                    ? "応援完了"
                    : isBoard && board!.scope === "voice" && (supCount?.pending ?? 0) + (supCount?.accepted ?? 0) > 0
                      ? "現在やり取り中"
                      : null
                }
                stampSub={
                  !isBoard && offer!.kind === "goods" && offer!.done && (reqCount?.accepted ?? 0) > 0
                    ? `${reqCount!.accepted}人に届きました`
                    : null
                }
                onOpen={(i) => setLb(i)}
              />
            )}
            {lb !== null && <Lightbox urls={images} index={lb} onClose={() => setLb(null)} />}
            {isBoard && board!.scope === "voice" && (
              <VoiceSupportBlock
                message={board!}
                userId={session.userId}
                isAdmin={session.isAdmin}
                counts={supCount}
                mySupport={mySup}
                requireJoin={() => setShowJoin(true)}
                onChanged={() => {
                  load();
                  loadRequests();
                }}
              />
            )}
            {!isBoard && offer!.kind === "goods" && (
              <GoodsSupportBlock
                offer={offer!}
                userId={session.userId}
                isAdmin={session.isAdmin}
                counts={reqCount}
                myRequest={myReq}
                requireJoin={() => setShowJoin(true)}
                onChanged={() => {
                  load();
                  loadRequests();
                }}
              />
            )}

            {/* いいね + コメント数（フィードと同じアイコン文法） */}
            <div className="mt-3 flex items-center gap-4">
              <button className="flex items-center gap-1" onClick={like} aria-label="いいね">
                <svg width="25" height="25" viewBox="0 0 24 24" fill={liked ? "#e8384f" : "none"} stroke={liked ? "#e8384f" : "#d96a1a"} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20.4C7 17.2 3.4 13.9 3.4 9.8c0-2.7 2.1-4.7 4.6-4.7 1.7 0 3.3 1 4 2.5.7-1.5 2.3-2.5 4-2.5 2.5 0 4.6 2 4.6 4.7 0 4.1-3.6 7.4-8.6 10.6z" />
                </svg>
                {likeCount > 0 && <span className="num text-[12.5px] font-bold text-[#8a8070]">{likeCount}</span>}
              </button>
              <span className="flex items-center gap-1" aria-label="コメント">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d96a1a" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 4.4c4.8 0 8.3 2.9 8.3 6.8s-3.5 6.8-8.3 6.8c-.9 0-1.7-.1-2.5-.3l-3.9 1.8 1-3.4c-1.8-1.2-2.9-3-2.9-4.9 0-3.9 3.5-6.8 8.3-6.8z" />
                </svg>
                {commentCount > 0 && <span className="num text-[12.5px] font-bold text-[#8a8070]">{commentCount}</span>}
              </span>
            </div>
            {likers.length > 0 && (
              <div className="mt-1 flex items-center">
                {likers.map((l, i) => (
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
                  {likers[0]?.display_name ?? ""}
                  {likeCount > 1 ? ` 他${likeCount - 1}人` : ""}
                </span>
              </div>
            )}
            {/* コメント欄は最初から開いておく（通知から来た人がすぐ読める） */}
            <CommentSection
              itemKey={itemKeyRef}
              userId={session.userId}
                    isAdmin={session.isAdmin}
              requireJoin={() => setShowJoin(true)}
              onAdded={() => setCommentCount((n) => n + 1)}
            />
          </>
        )}
      </div>

      {crop.element}
      {showJoin && <JoinDialog onClose={() => setShowJoin(false)} />}

      {reportOpen && session.userId && (
        <ReportDialog
          itemKey={itemKey}
          excerpt={body}
          meId={session.userId}
          onClose={() => setReportOpen(false)}
        />
      )}
    </main>
  );
}

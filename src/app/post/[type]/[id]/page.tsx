"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/useSession";
import {
  deleteBoardMessage,
  deleteOffer,
  fetchBoardMessageById,
  fetchOfferById,
  updateBoardMessage,
  updateOfferDetail,
  type BoardMessage,
  type Offer,
} from "@/lib/db";
import { uploadImagePair, type ImagePair } from "@/lib/images";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { DotsMenu } from "@/components/PostKit";
import { ReportDialog } from "@/components/ReportDialog";
import { EmbedCard, type OGPEmbed } from "@/components/EmbedCard";

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
  const [reportOpen, setReportOpen] = useState(false);
  const editStarted = useRef(false);

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
      setEditImgs([]);
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
      await updateOfferDetail(id, draft.trim());
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
    : offer!.image_url
      ? [offer!.image_url]
      : [];
  const itemKey = `${type}:${id}`;

  return (
    <main className="min-h-screen pb-16" style={{ background: "#faf6ee" }}>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[#ede5d8] bg-white/95 px-4 py-3 backdrop-blur-sm">
        <button onClick={() => router.back()} className="text-xl" style={{ color: "#d96a1a" }} aria-label="戻る">
          ←
        </button>
        <span className="text-[14px] font-bold text-[#1c1e21]">投稿</span>
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
              {memberNo != null && <span className="num ml-1.5">@ボランティアNo.{memberNo}</span>}
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
            {isBoard && (
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
                      onChange={async (e) => {
                        if (!session.userId || !e.target.files?.length || uploading) return;
                        setUploading(true);
                        const files = Array.from(e.target.files).slice(0, 4 - editImgs.length);
                        const pairs: ImagePair[] = [];
                        for (const f of files) {
                          const p = await uploadImagePair(session.userId, f);
                          if (p) pairs.push(p);
                        }
                        if (pairs.length) setEditImgs((prev) => [...prev, ...pairs].slice(0, 4));
                        setUploading(false);
                        e.target.value = "";
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
                {body}
              </p>
            )}
            {isBoard && board!.embed && (
              <div className="mt-2">
                <EmbedCard embed={board!.embed as OGPEmbed} />
              </div>
            )}
            {images.map((u) => (
              <div key={u} className="-mx-4 mt-2">
                <img src={u} alt="" className="w-full object-cover" />
              </div>
            ))}
          </>
        )}
      </div>

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

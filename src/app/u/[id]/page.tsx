"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/useSession";
import {
  fetchOffersByUser,
  fetchProfile,
  getOrCreateChat,
  uploadPhoto,
  upsertMyProfile,
  type Offer,
  type Profile,
} from "@/lib/db";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { SnsIcon } from "@/components/SnsIcon";
import { RegisterDialog } from "@/components/RegisterDialog";
import { BottomNav } from "@/components/BottomNav";

/** マイページ（OneSeaのマイページから移植・簡素化版: カバー + 重なるアバター + 認証マーク + 出せる物資 + SNS） */
export default function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const session = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [goods, setGoods] = useState<Offer[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"cover" | "avatar" | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  const load = () => {
    fetchProfile(id).then(setProfile);
    fetchOffersByUser(id).then((rows) => setGoods(rows.filter((o) => o.kind === "goods")));
  };
  useEffect(load, [id]);

  const isMe = session.userId === id;

  const changeImage = async (kind: "cover" | "avatar", file: File | null) => {
    if (!isMe || !file || busy || !session.userId) return;
    setBusy(kind);
    const url = await uploadPhoto(file, session.userId);
    if (url) {
      await upsertMyProfile(session.userId, kind === "cover" ? { cover_url: url } : { avatar_url: url });
      load();
    }
    setBusy(null);
  };

  if (profile === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#faf6ee" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c94d3a] border-t-transparent" />
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="px-4 py-16 text-center" style={{ background: "#faf6ee" }}>
        <p className="text-sm text-[#8a8070]">この参加者は見つかりませんでした</p>
        <Link href="/" className="mt-4 inline-block text-sm underline" style={{ color: "#c94d3a" }}>
          ホームへもどる
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-24" style={{ background: "#f2ede4" }}>
      {/* カバー画像 */}
      <div className="relative h-44 w-full overflow-hidden">
        {profile.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{ background: "linear-gradient(160deg,#c94d3a 0%,#a03020 60%,#7a2418 100%)" }}
          />
        )}
        <Link
          href="/"
          className="absolute left-3 top-3 z-10 rounded-full bg-black/40 px-3 py-1.5 text-[12px] font-bold text-white no-underline backdrop-blur-sm"
        >
          ← ホーム
        </Link>
        {isMe && (
          <>
            <button
              onClick={() => coverInput.current?.click()}
              className="absolute bottom-2.5 right-3 rounded-full bg-black/50 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm"
            >
              {busy === "cover" ? "⏳" : "📷 背景を変える"}
            </button>
            <input
              ref={coverInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => changeImage("cover", e.target.files?.[0] ?? null)}
            />
          </>
        )}
      </div>

      {/* アバター + 名前 */}
      <div className="relative px-4">
        <div className="relative -mt-11 inline-block">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              referrerPolicy="no-referrer"
              className="h-[88px] w-[88px] rounded-full border-4 border-[#f2ede4] object-cover shadow-md"
            />
          ) : (
            <div
              className="flex h-[88px] w-[88px] items-center justify-center rounded-full border-4 border-[#f2ede4] shadow-md"
              style={{ background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-leaf.webp" alt="" style={{ width: 22, height: 22 }} />
            </div>
          )}
          {isMe && (
            <>
              <button
                onClick={() => avatarInput.current?.click()}
                aria-label="アイコンを変える"
                className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[12px] text-white shadow"
                style={{ background: "#c94d3a" }}
              >
                {busy === "avatar" ? "⏳" : "📷"}
              </button>
              <input
                ref={avatarInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => changeImage("avatar", e.target.files?.[0] ?? null)}
              />
            </>
          )}
        </div>

        <div className="relative mt-1.5">
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold leading-snug text-[#3a3428]">
            {profile.display_name || "参加者"}
            <VerifiedBadge size={17} />
          </h1>
          {profile.member_no != null && (
            <div className="num text-[12px] text-[#a09888]">@ボランティアNo.{profile.member_no}</div>
          )}

          {/* 連絡を取る（他人のページ・OneSeaと同じピル+アイコン） */}
          {session.userId && !isMe && (
            <button
              onClick={async () => {
                const chatId = await getOrCreateChat(session.userId!, profile.id);
                if (chatId) router.push(`/talk/${chatId}`);
              }}
              className="mt-2 inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1.5 text-[11.5px] font-extrabold"
              style={{ borderColor: "#c94d3a", color: "#c94d3a" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-talk-green.webp" alt="" style={{ width: 14, height: 14 }} /> 連絡を取る
            </button>
          )}

          {isMe && (
            <button
              onClick={() => setEditing(true)}
              className="mt-3 block w-full rounded-xl border border-[#e0d6c6] bg-white py-2.5 text-center text-[13px] font-bold text-[#8a7a5a]"
            >
              プロフィールを編集
            </button>
          )}

          {/* 自己紹介 */}
          {profile.bio && (
            <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[#5a5448]">
              {profile.bio}
            </p>
          )}

          {/* SNS一覧 */}
          {profile.sns && Object.keys(profile.sns).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(profile.sns).map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ede5d8] bg-white"
                  aria-label={platform}
                >
                  <SnsIcon platform={platform.replace(/\d+$/, "")} size={22} />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 出せる物資（OneSeaの出品一覧グリッドを移植） */}
      <div className="px-4 pt-5">
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <div className="mb-2.5 flex items-center gap-1.5 text-[13px] font-extrabold text-[#5a5448]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-listing.webp" alt="" style={{ width: 18, height: 18 }} />
            <span>{`${profile.display_name || "この人"}さんの出せる物資`}</span>
          </div>
          {goods.length === 0 ? (
            <p className="py-2 text-[13px] text-[#b8b0a0]">
              まだ物資の登録がありません
              {isMe && (
                <>
                  。<Link href="/" className="underline" style={{ color: "#c94d3a" }}>ホームの「物資を出す」</Link>から登録できます
                </>
              )}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {goods.map((o) => (
                <div
                  key={o.id}
                  className="relative flex h-full flex-col overflow-hidden rounded-md border border-[#ede5d8] shadow-sm"
                  style={{ background: "linear-gradient(180deg,#fffaf0,#fdf6e9)" }}
                >
                  <div className="absolute left-0 right-0 top-0 z-10 h-[3px]" style={{ background: "#c94d3a" }} />
                  <div className="relative aspect-square overflow-hidden bg-[#f2ede4]">
                    {o.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.image_url} alt={o.title ?? ""} className="h-full w-full object-cover" />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center"
                        style={{ background: "linear-gradient(135deg,#c94d3a 0%,#d4a043 50%,#5a7d4a 100%)" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/waraeru-archangel.png" alt="" className="h-12 w-12 rounded-full object-cover opacity-90" />
                      </div>
                    )}
                    {o.status === "done" && (
                      <span
                        className="pointer-events-none absolute left-1/2 top-1/2 z-10 border-[3px] border-[#d02020] px-2 py-0.5 text-[13px] font-extrabold tracking-[2px] text-[#d02020]"
                        style={{ transform: "translate(-50%,-50%) rotate(-18deg)", background: "rgba(255,255,255,.6)", whiteSpace: "nowrap" }}
                      >
                        届けました
                      </span>
                    )}
                  </div>
                  <div className="px-2 py-1.5">
                    <h3 className="line-clamp-1 text-[12px] font-bold leading-tight text-[#3a3428]">
                      {o.title ?? "物資"}
                    </h3>
                    <p className="line-clamp-1 text-[10.5px] text-[#8a8070]">{o.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editing && session.userId && (
        <RegisterDialog
          userId={session.userId}
          initial={{
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            bio: profile.bio,
            sns: profile.sns,
          }}
          isFirst={false}
          onDone={() => {
            setEditing(false);
            load();
            session.refresh();
          }}
          onClose={() => setEditing(false)}
        />
      )}

      <BottomNav userId={session.userId} active={isMe ? "my" : "home"} />
    </main>
  );
}

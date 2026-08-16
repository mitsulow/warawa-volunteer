"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import { saveMyEmail, upsertMyProfile } from "@/lib/db";
import { TERMS_VERSION } from "@/lib/terms";
import { TermsBody } from "@/components/TermsBody";
import { SnsIcon } from "@/components/SnsIcon";

/** SNS入力欄（OneSeaのプロフィール設定と同じ形式） */
const SNS_FIELDS = [
  { id: "instagram", label: "Instagram", placeholder: "https://instagram.com/..." },
  { id: "x", label: "X", placeholder: "https://x.com/..." },
  { id: "youtube", label: "YouTube", placeholder: "https://youtube.com/@..." },
  { id: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@..." },
  { id: "facebook", label: "Facebook", placeholder: "https://facebook.com/..." },
  { id: "threads", label: "Threads", placeholder: "https://threads.net/@..." },
  { id: "line", label: "LINE公式", placeholder: "https://lin.ee/..." },
  { id: "note", label: "note", placeholder: "https://note.com/..." },
  { id: "ameblo", label: "アメブロ", placeholder: "https://ameblo.jp/..." },
  { id: "website", label: "ウェブサイト", placeholder: "https://..." },
] as const;

/**
 * 最初の登録フォーム（Googleログイン直後）/ プロフィール編集（同じフォームを再利用）。
 * 名前・メールはGoogleの値を最初から入れておく（変更可）。
 * SNSはOneSeaと同じ「サービス別の入力欄」形式。
 */
export function RegisterDialog({
  userId,
  initial,
  isFirst,
  onDone,
  onClose,
}: {
  userId: string;
  initial: {
    display_name: string;
    avatar_url: string | null;
    email: string;
    bio?: string | null;
    sns: Record<string, string> | null;
  };
  isFirst: boolean;
  onDone: () => void;
  onClose?: () => void;
}) {
  const [name, setName] = useState(initial.display_name);
  const [hitokoto, setHitokoto] = useState(initial.bio ?? "");
  const [email, setEmail] = useState(initial.email);
  const [sns, setSns] = useState<Record<string, string>>(initial.sns ?? {});
  const [snsOpen, setSnsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // 空欄ならGoogleの名前・メールを先に入れておく
  useEffect(() => {
    if (name && email) return;
    createClient()
      .auth.getUser()
      .then(({ data }: { data: { user: User | null } }) => {
        const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
        setName((prev) =>
          prev || (meta.full_name as string) || (meta.name as string) || ""
        );
        setEmail((prev) => prev || data.user?.email || "");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [agreed, setAgreed] = useState(!isFirst);
  const [termsOpen, setTermsOpen] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      setError("お名前を入れてください");
      return;
    }
    if (isFirst && !agreed) {
      setError("「上記に了承します」にチェックを入れてください");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("メールアドレスの形式を確認してください");
      return;
    }
    setBusy(true);
    setError("");
    const snsClean: Record<string, string> = {};
    for (const [k, v] of Object.entries(sns)) if (v.trim()) snsClean[k] = v.trim();
    const { error: e } = await upsertMyProfile(userId, {
      display_name: name.trim(),
      avatar_url: initial.avatar_url,
      bio: hitokoto.trim() || null,
      sns: Object.keys(snsClean).length ? snsClean : null,
      ...(isFirst
        ? { terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION }
        : {}),
    });
    if (!e) await saveMyEmail(userId, email.trim());
    setBusy(false);
    if (e) {
      setError("保存できませんでした。もう一度お試しください");
      return;
    }
    onDone();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={isFirst ? undefined : onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold">
          {isFirst ? "ようこそ！登録フォーム" : "プロフィールを編集"}
        </h3>
        {isFirst && (
          <p className="mt-1 mb-3 text-sm text-[#8a8070]">
            登録すると <b>わらわ〜ボランティアNo.</b> と認証マークが付きます。
          </p>
        )}

        <label className="mt-2 block text-sm font-bold">
          お名前{" "}
          <span className="font-normal text-[#a09888]">（ニックネームもOKです）</span>
        </label>
        <input
          className="mt-1 w-full rounded-xl border border-[#e0d6c6] px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
        />

        <label className="mt-3 block text-sm font-bold">
          みんなにひとこと{" "}
          <span className="font-normal text-[#a09888]">（任意）</span>
        </label>
        <input
          className="mt-1 w-full rounded-xl border border-[#e0d6c6] px-3 py-2"
          placeholder="よろしくお願いします！"
          value={hitokoto}
          onChange={(e) => setHitokoto(e.target.value)}
          maxLength={60}
        />

        <label className="mt-3 block text-sm font-bold">
          メールアドレス{" "}
          <span className="font-normal text-[#a09888]">（連絡を取る時に使います）</span>
        </label>
        <input
          type="email"
          className="mt-1 w-full rounded-xl border border-[#e0d6c6] px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className="mt-1 text-[11px] text-[#a09888]">他の参加者には公開されません</p>

        <button
          type="button"
          onClick={() => setSnsOpen(!snsOpen)}
          className="mt-3 flex w-full items-center justify-between rounded-xl border border-[#ede5d8] bg-[#fffaf0] px-3 py-2.5 text-left"
        >
          <span className="text-[12.5px] font-bold text-[#8a7a5a]">
            SNSリンクがあれば登録できます
          </span>
          <span className="text-[#b0a898]">{snsOpen ? "▲" : "▼"}</span>
        </button>
        {snsOpen && (
          <div className="mt-2 space-y-2">
            {SNS_FIELDS.map((f) => (
              <div key={f.id} className="flex items-center gap-2">
                <span className="flex w-24 flex-shrink-0 items-center gap-1.5 text-[11px] text-[#8a8070]">
                  <SnsIcon platform={f.id} size={18} />
                  {f.label}
                </span>
                <input
                  value={sns[f.id] ?? ""}
                  onChange={(e) => setSns({ ...sns, [f.id]: e.target.value })}
                  placeholder={f.placeholder}
                  className="min-w-0 flex-1 rounded-lg border border-[#ede5d8] bg-white px-2.5 py-2 text-[12px] outline-none focus:border-[#d96a1a]"
                />
              </div>
            ))}
          </div>
        )}

        {/* 初回登録: 了承事項（スクロール枠に折りたたみ）→「上記に了承します」 */}
        {isFirst && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setTermsOpen(!termsOpen)}
              className="flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left"
              style={{ borderColor: "#e8dcc4", background: "#fffaf0" }}
            >
              <span className="text-[12.5px] font-bold text-[#5a5448]">ご利用にあたっての了承事項を読む</span>
              <span className="text-[#b0a898]">{termsOpen ? "▲" : "▼"}</span>
            </button>
            {termsOpen && (
              <div className="mt-2 max-h-[38dvh] overflow-y-auto rounded-xl border p-3" style={{ borderColor: "#e8dcc4", background: "#fffdf8" }}>
                <TermsBody compact />
              </div>
            )}
            <label
              className="mt-2 flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5"
              style={{ borderColor: agreed ? "#d96a1a" : "#e8dcc4", background: agreed ? "#fdf0e0" : "#fff" }}
            >
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-5 w-5 accent-[#d96a1a]" />
              <span className="text-[13.5px] font-extrabold text-[#3a3428]">上記に了承します</span>
            </label>
            <p className="mt-1 text-[10.5px] text-[#a09888]">
              全文は <Link href="/terms" target="_blank" className="underline">こちら</Link> でいつでも読めます
            </p>
          </div>
        )}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button
          className="mt-4 w-full rounded-xl py-3 font-bold text-white disabled:opacity-50"
          style={{ background: "#d96a1a" }}
          disabled={busy}
          onClick={save}
        >
          {busy ? "保存中…" : isFirst ? "登録して参加する" : "保存する"}
        </button>
        {!isFirst && onClose && (
          <button className="mt-2 w-full py-2 text-sm text-[#a09888] underline" onClick={onClose}>
            やめる
          </button>
        )}
      </div>
    </div>
  );
}

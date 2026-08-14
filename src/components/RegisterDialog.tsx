"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { saveMyEmail, upsertMyProfile } from "@/lib/db";
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
    sns: Record<string, string> | null;
  };
  isFirst: boolean;
  onDone: () => void;
  onClose?: () => void;
}) {
  const [name, setName] = useState(initial.display_name);
  const [email, setEmail] = useState(initial.email);
  const [sns, setSns] = useState<Record<string, string>>(initial.sns ?? {});
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

  const save = async () => {
    if (!name.trim()) {
      setError("お名前を入れてください");
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
      sns: Object.keys(snsClean).length ? snsClean : null,
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
            登録すると <b>ボランティアNo.</b> と認証マークが付きます。
          </p>
        )}

        <label className="mt-2 block text-sm font-bold">
          お名前{" "}
          <span className="font-normal text-[#a09888]">（ペンネームでもOKです）</span>
        </label>
        <input
          className="mt-1 w-full rounded-xl border border-[#e0d6c6] px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
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

        <label className="mt-3 block text-sm font-bold">SNSリンク</label>
        <p className="mt-0.5 mb-1.5 text-[11px] text-[#a09888]">
          ※SNSで情報発信をされている方はご登録ください（任意です）
        </p>
        <div className="space-y-2">
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

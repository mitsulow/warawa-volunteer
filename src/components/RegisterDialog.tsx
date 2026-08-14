"use client";

import { useState } from "react";
import { upsertMyProfile, type Profile } from "@/lib/db";
import { detectPlatform, getPlatformLabel } from "@/components/SnsIcon";

/**
 * 最初の登録フォーム（Googleログイン直後）/ プロフィール編集（同じフォームを再利用）。
 * 入力: お名前（Googleから自動）・自己紹介（任意）・SNSリンク（URLを貼るだけ・複数可）。
 * ボランティアNo.はDB側で登録順に自動採番。
 */
export function RegisterDialog({
  userId,
  initial,
  isFirst,
  onDone,
  onClose,
}: {
  userId: string;
  initial: { display_name: string; avatar_url: string | null; bio: string | null; sns: Record<string, string> | null };
  isFirst: boolean;
  onDone: () => void;
  onClose?: () => void;
}) {
  const [name, setName] = useState(initial.display_name);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [snsLines, setSnsLines] = useState(
    Object.values(initial.sns ?? {}).join("\n")
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!name.trim()) {
      setError("お名前を入れてください");
      return;
    }
    setBusy(true);
    setError("");
    const sns: Record<string, string> = {};
    for (const line of snsLines.split(/\s+/)) {
      const url = line.trim();
      if (!/^https?:\/\//.test(url)) continue;
      let key = detectPlatform(url);
      // 同じSNSを複数貼れるように連番で逃がす
      let i = 2;
      while (sns[key]) key = `${detectPlatform(url)}${i++}`;
      sns[key] = url;
    }
    const { error: e } = await upsertMyProfile(userId, {
      display_name: name.trim(),
      avatar_url: initial.avatar_url,
      bio: bio.trim() || null,
      sns: Object.keys(sns).length ? sns : null,
    });
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
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
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

        <label className="mt-2 block text-sm font-bold">お名前</label>
        <input
          className="mt-1 w-full rounded-xl border border-[#e0d6c6] px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
        />

        <label className="mt-3 block text-sm font-bold">
          自己紹介 <span className="font-normal text-[#a09888]">（任意）</span>
        </label>
        <textarea
          className="mt-1 w-full rounded-xl border border-[#e0d6c6] px-3 py-2"
          rows={3}
          maxLength={300}
          placeholder="やっていること・支援への想いなど"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />

        <label className="mt-3 block text-sm font-bold">
          SNSリンク <span className="font-normal text-[#a09888]">（任意・1行に1つ貼るだけ）</span>
        </label>
        <textarea
          className="mt-1 w-full rounded-xl border border-[#e0d6c6] px-3 py-2 text-[13px]"
          rows={3}
          placeholder={"https://instagram.com/...\nhttps://x.com/...\nhttps://youtube.com/..."}
          value={snsLines}
          onChange={(e) => setSnsLines(e.target.value)}
        />
        {snsLines.trim() && (
          <p className="mt-1 text-[11px] text-[#8a8070]">
            認識:{" "}
            {[...new Set(
              snsLines
                .split(/\s+/)
                .filter((l) => /^https?:\/\//.test(l.trim()))
                .map((l) => getPlatformLabel(detectPlatform(l.trim())))
            )].join("・") || "なし"}
          </p>
        )}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button
          className="mt-4 w-full rounded-xl py-3 font-bold text-white disabled:opacity-50"
          style={{ background: "#c94d3a" }}
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

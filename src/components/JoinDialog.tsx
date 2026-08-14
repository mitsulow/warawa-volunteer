"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { upsertMyProfile } from "@/lib/db";

/**
 * 参加（ログイン）ダイアログ。
 * 基本はニックネームだけの即時参加（匿名認証）。
 * 機種変更しても続けたい人向けにメールMagic Linkも用意。
 */
export function JoinDialog({
  onClose,
  onJoined,
}: {
  onClose: () => void;
  onJoined: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"quick" | "email">("quick");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const joinQuick = async () => {
    if (!name.trim()) {
      setError("お名前（ニックネーム）を入れてください");
      return;
    }
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data, error: e } = await supabase.auth.signInAnonymously();
    if (e || !data.user) {
      setBusy(false);
      setError("参加に失敗しました。少し待ってもう一度お試しください");
      return;
    }
    await upsertMyProfile(data.user.id, name.trim());
    setBusy(false);
    onJoined();
    onClose();
  };

  const joinEmail = async () => {
    if (!email.trim()) {
      setError("メールアドレスを入れてください");
      return;
    }
    setBusy(true);
    setError("");
    const supabase = createClient();
    if (name.trim()) {
      try {
        localStorage.setItem("warawa-pending-name", name.trim());
      } catch {}
    }
    const { error: e } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (e) {
      setError("送信できませんでした。時間をおいてお試しください");
      return;
    }
    setSent(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-1">参加する</h3>
        <p className="text-sm text-gray-600 mb-4">
          お名前を書いて参加すると、意思表明・掲示板・Talkが使えます。
        </p>

        {sent ? (
          <div className="rounded-xl bg-[#faf6ee] p-4 text-sm">
            📮 ログイン用リンクをメールに送りました。
            <br />
            メール内のリンクを開くと参加完了です。
          </div>
        ) : (
          <>
            <label className="block text-sm font-bold mb-1">
              お名前（ニックネームOK）
            </label>
            <input
              className="w-full rounded-xl border border-gray-300 px-3 py-2 mb-3"
              placeholder="例: みつろう"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
            />

            {mode === "email" && (
              <>
                <label className="block text-sm font-bold mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 mb-3"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </>
            )}

            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

            {mode === "quick" ? (
              <>
                <button
                  className="w-full rounded-xl bg-[#d96c2c] py-3 text-white font-bold disabled:opacity-50"
                  disabled={busy}
                  onClick={joinQuick}
                >
                  {busy ? "参加中…" : "今すぐ参加する"}
                </button>
                <button
                  className="w-full mt-2 py-2 text-sm text-gray-500 underline"
                  onClick={() => setMode("email")}
                >
                  メールでログインする（機種変更しても続けたい方）
                </button>
              </>
            ) : (
              <>
                <button
                  className="w-full rounded-xl bg-[#3a7d44] py-3 text-white font-bold disabled:opacity-50"
                  disabled={busy}
                  onClick={joinEmail}
                >
                  {busy ? "送信中…" : "ログインリンクを送る"}
                </button>
                <button
                  className="w-full mt-2 py-2 text-sm text-gray-500 underline"
                  onClick={() => setMode("quick")}
                >
                  ← ニックネームだけで今すぐ参加
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

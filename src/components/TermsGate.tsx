"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { acceptTerms } from "@/lib/db";
import { TERMS_VERSION } from "@/lib/terms";
import { TermsBody } from "@/components/TermsBody";

/**
 * 了承事項ゲート（layout常駐）。
 * 閲覧だけの人（未ログイン）には出ない。ログイン済み＝書き込み権限のある人で、
 * まだ了承していない（or 改訂後に未了承の）人にだけ全面表示し、「上記に了承します」を経ないと使えない。
 * 初回登録(RegisterDialog)の中で了承した人はここには掛からない。
 */
export function TermsGate() {
  const session = useSession();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const need =
    mounted &&
    !session.loading &&
    !!session.userId &&
    !!session.profile && // プロフィール未作成(=登録フォーム表示中)は RegisterDialog 側で了承を取る
    session.profile.terms_version !== TERMS_VERSION;

  if (!need) return null;

  const accept = async () => {
    if (!checked || busy || !session.userId) return;
    setBusy(true);
    const { error } = await acceptTerms(session.userId);
    setBusy(false);
    if (error) {
      window.alert("保存できませんでした。もう一度お試しください");
      return;
    }
    session.refresh();
  };

  const logout = async () => {
    await createClient().auth.signOut();
    window.location.href = "/";
  };

  return createPortal(
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="px-5 pt-5">
          <h2 className="text-[17px] font-extrabold text-[#3a3428]">ご利用にあたって</h2>
        </div>
        {/* 本文はスクロール枠（規約置き場の定番の形） */}
        <div
          className="mx-5 mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border p-3"
          style={{ borderColor: "#e8dcc4", background: "#fffdf8", maxHeight: "48dvh" }}
        >
          <TermsBody compact />
        </div>
        <div className="px-5 pb-5 pt-3">
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5" style={{ borderColor: checked ? "#d96a1a" : "#e8dcc4", background: checked ? "#fdf0e0" : "#fff" }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="h-5 w-5 accent-[#d96a1a]"
            />
            <span className="text-[14px] font-extrabold text-[#3a3428]">上記に了承します</span>
          </label>
          <button
            className="mt-3 w-full rounded-xl py-3 text-[15px] font-extrabold text-white disabled:opacity-40"
            style={{ background: "#d96a1a" }}
            disabled={!checked || busy}
            onClick={accept}
          >
            {busy ? "保存中…" : "利用をはじめる"}
          </button>
          <button className="mt-2 w-full py-1.5 text-[12px] text-[#a09888] underline" onClick={logout}>
            了承せずにログアウトする（閲覧だけならログイン不要です）
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

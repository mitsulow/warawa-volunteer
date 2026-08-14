"use client";

import { useEffect, useState } from "react";
import {
  addOffer,
  fetchMyPrivate,
  saveMyPrivate,
  upsertMyProfile,
  type Profile,
} from "@/lib/db";
import { detectPlatform } from "@/components/SnsIcon";

/**
 * 🏃 体を出す = 現地入りメンバー申請フォーム。
 * 名前・電話番号・メールアドレス・SNS・行ける日程を書いて「事務局に申請する」。
 * 電話とメールは profile_private（本人+事務局のみ閲覧可）に保存。
 * 事務局が選ぶと🟠オレンジ軍団（現地入りメンバー）としてトップに並ぶ。
 */
export function BodyApplyDialog({
  userId,
  profile,
  onClose,
  onDone,
}: {
  userId: string;
  profile: Profile;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(profile.display_name);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [snsLines, setSnsLines] = useState(
    Object.values(profile.sns ?? {}).join("\n")
  );
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetchMyPrivate(userId).then((p) => {
      if (p.phone) setPhone(p.phone);
      if (p.email) setEmail(p.email);
    });
  }, [userId]);

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !email.trim() || !detail.trim()) {
      setError("名前・電話番号・メールアドレス・行ける日程は必須です");
      return;
    }
    setBusy(true);
    setError("");
    const sns: Record<string, string> = {};
    for (const line of snsLines.split(/\s+/)) {
      const url = line.trim();
      if (!/^https?:\/\//.test(url)) continue;
      let key = detectPlatform(url);
      let i = 2;
      while (sns[key]) key = `${detectPlatform(url)}${i++}`;
      sns[key] = url;
    }
    await upsertMyProfile(userId, {
      display_name: name.trim(),
      sns: Object.keys(sns).length ? sns : profile.sns,
    });
    await saveMyPrivate(userId, phone.trim(), email.trim());
    const { error: e } = await addOffer(userId, "body", detail.trim());
    setBusy(false);
    if (e) {
      setError("送信できませんでした。もう一度お試しください");
      return;
    }
    setSent(true);
    onDone();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="text-center">
            <div className="text-3xl">🟠</div>
            <h3 className="mt-2 text-lg font-bold">申請を送りました</h3>
            <p className="mt-2 text-sm text-[#8a8070]">
              事務局が確認して現地入りメンバーが決まると、
              トップの🟠オレンジ軍団にあなたが並びます。
              連絡はTalKまたはお電話で届きます。
            </p>
            <button
              className="mt-4 w-full rounded-xl py-3 font-bold text-white"
              style={{ background: "#d96a1a" }}
              onClick={onClose}
            >
              閉じる
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold">🏃 現地入りメンバーになる</h3>
            <p className="mt-1 mb-3 text-sm text-[#8a8070]">
              旅費は寄付金から支給されます。電話番号とメールアドレスは
              事務局だけが見られます（公開されません）。
            </p>

            <label className="block text-sm font-bold">お名前</label>
            <input
              className="mt-1 w-full rounded-xl border border-[#e0d6c6] px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
            />

            <label className="mt-3 block text-sm font-bold">電話番号</label>
            <input
              type="tel"
              className="mt-1 w-full rounded-xl border border-[#e0d6c6] px-3 py-2"
              placeholder="090-0000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <label className="mt-3 block text-sm font-bold">メールアドレス</label>
            <input
              type="email"
              className="mt-1 w-full rounded-xl border border-[#e0d6c6] px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label className="mt-3 block text-sm font-bold">
              SNS <span className="font-normal text-[#a09888]">（任意・URLを1行に1つ）</span>
            </label>
            <textarea
              className="mt-1 w-full rounded-xl border border-[#e0d6c6] px-3 py-2 text-[13px]"
              rows={2}
              placeholder="https://instagram.com/..."
              value={snsLines}
              onChange={(e) => setSnsLines(e.target.value)}
            />

            <label className="mt-3 block text-sm font-bold">行ける日程・できること</label>
            <textarea
              className="mt-1 w-full rounded-xl border border-[#e0d6c6] px-3 py-2"
              rows={3}
              placeholder="例: 8/20〜8/23 行けます。車あり。力仕事OK"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <button
              className="mt-4 w-full rounded-xl py-3 font-bold text-white disabled:opacity-50"
              style={{ background: "#d96a1a" }}
              disabled={busy}
              onClick={submit}
            >
              {busy ? "送信中…" : "事務局に申請する"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

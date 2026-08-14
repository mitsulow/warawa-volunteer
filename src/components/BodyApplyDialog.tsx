"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import {
  addOffer,
  fetchMyPrivate,
  upsertMyProfile,
  type Profile,
} from "@/lib/db";
import { detectPlatform, getPlatformLabel } from "@/components/SnsIcon";
import { DEFAULT_PREF, PREF_ORDER, fetchMunicipalities } from "@/lib/prefs";

/**
 * 🏃 体を出す = 現地入りメンバー申請フォーム。
 * 名前(本名)・携帯番号・メール(Googleのを事前入力)・住んでいる場所(都道府県+市町村・海外あり)・
 * 本人確認のSNS(URL貼るだけ)・私にできる事・動ける期間/アピール → 「事務局に申請する」。
 * 連絡先と住まいは profile_private（本人+事務局のみ閲覧可）に保存。
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
  const [pref, setPref] = useState(DEFAULT_PREF);
  const [city, setCity] = useState("");
  const [cities, setCities] = useState<Record<string, string[]>>({});
  const [snsLines, setSnsLines] = useState(
    Object.values(profile.sns ?? {}).join("\n")
  );
  const [canDo, setCanDo] = useState("");
  const [appeal, setAppeal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const overseas = pref === "海外";

  useEffect(() => {
    fetchMunicipalities().then(setCities);
    fetchMyPrivate(userId).then((p) => {
      if (p.phone) setPhone(p.phone);
      if (p.email) setEmail(p.email);
    });
    // メール未登録ならGoogle認証のメールを先に入れておく
    createClient()
      .auth.getUser()
      .then(({ data }: { data: { user: User | null } }) => {
        setEmail((prev) => prev || data.user?.email || "");
      });
  }, [userId]);

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !email.trim() || !canDo.trim()) {
      setError("名前・携帯番号・メールアドレス・私にできる事は必須です");
      return;
    }
    if (!overseas && !city) {
      setError("市町村を選んでください");
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
    const supabase = createClient();
    await supabase.from("profile_private").upsert({
      id: userId,
      phone: phone.trim(),
      email: email.trim(),
      pref,
      city: overseas ? city.trim() || "海外" : city,
    });
    const detail = `【私にできる事】${canDo.trim()}${appeal.trim() ? `\n【動ける期間・アピール】${appeal.trim()}` : ""}`;
    const { error: e } = await addOffer(userId, "body", detail);
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
        className="max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="text-center">
            <div className="text-3xl">🟠</div>
            <h3 className="mt-2 text-lg font-bold">申請を事務局に送りました</h3>
            <p className="mt-2 text-sm text-[#8a8070]">
              事務局が確認して現地入りメンバーが決まると、
              トップの現地入りメンバーにあなたが並びます。
              連絡はTalK・お電話・メールで届きます。
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
            <h3 className="flex items-center gap-2 text-lg font-bold">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-tasukete.webp" alt="" className="h-7 w-7 object-contain" />
              現地入りするメンバーに立候補
            </h3>
            <p className="mt-1 mb-3 text-sm text-[#8a8070]">
              旅費は寄付金から支給されます。連絡先と住まいは事務局だけが見られます（公開されません）。
            </p>

            <label className="block text-sm font-bold">お名前（本名）</label>
            <input
              className="mt-1 w-full rounded-xl border border-[#e0d6c6] px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
            />

            <label className="mt-3 block text-sm font-bold">携帯番号</label>
            <input
              type="tel"
              className="mt-1 w-full rounded-xl border border-[#e0d6c6] px-3 py-2"
              placeholder="090-0000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <label className="mt-3 block text-sm font-bold">
              メールアドレス <span className="font-normal text-[#a09888]">（変更可能です）</span>
            </label>
            <input
              type="email"
              className="mt-1 w-full rounded-xl border border-[#e0d6c6] px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label className="mt-3 block text-sm font-bold">住んでいる場所</label>
            <div className="mt-1 flex gap-2">
              <select
                value={pref}
                onChange={(e) => {
                  setPref(e.target.value);
                  setCity("");
                }}
                className="w-[42%] rounded-xl border border-[#e0d6c6] bg-white px-2 py-2.5 text-[13.5px]"
              >
                {[...PREF_ORDER, "海外"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {overseas ? (
                <input
                  className="min-w-0 flex-1 rounded-xl border border-[#e0d6c6] px-3 py-2 text-[13.5px]"
                  placeholder="国・都市（例: アメリカ ロサンゼルス）"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              ) : (
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-[#e0d6c6] bg-white px-2 py-2.5 text-[13.5px]"
                >
                  <option value="">市町村を選ぶ</option>
                  {(cities[pref] ?? []).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <label className="mt-3 block text-sm font-bold">
              本人を確認するため、やっているSNSを全て貼ってください
            </label>
            <p className="mt-0.5 text-[11px] text-[#a09888]">
              URLを1行に1つ貼るだけでOK（Instagram / X / YouTube / Facebook / note / アメブロ / LINEなど）
            </p>
            <textarea
              className="mt-1 w-full rounded-xl border border-[#e0d6c6] px-3 py-2 text-[13px]"
              rows={3}
              placeholder={"https://instagram.com/...\nhttps://x.com/..."}
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

            <label className="mt-3 block text-sm font-bold">私にできる事</label>
            <textarea
              className="mt-1 w-full rounded-xl border border-[#e0d6c6] px-3 py-2"
              rows={2}
              placeholder="整体師です、マッサージが出来ます"
              value={canDo}
              onChange={(e) => setCanDo(e.target.value)}
            />

            <label className="mt-3 block text-sm font-bold">
              動ける期間・他にアピールしたいポイントなど
            </label>
            <textarea
              className="mt-1 w-full rounded-xl border border-[#e0d6c6] px-3 py-2"
              rows={3}
              placeholder="8月下旬から9月上旬まで自由に動けます。車あり、力仕事OKなど"
              value={appeal}
              onChange={(e) => setAppeal(e.target.value)}
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

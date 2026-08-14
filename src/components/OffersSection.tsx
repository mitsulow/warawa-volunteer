"use client";

import { useEffect, useState } from "react";
import { addOffer, fetchOffers, type Offer, type OfferKind } from "@/lib/db";
import { Avatar } from "@/components/Avatar";

const KINDS: Record<
  OfferKind,
  { emoji: string; label: string; verb: string; help: string; placeholder: string }
> = {
  money: {
    emoji: "💰",
    label: "お金を出す",
    verb: "お金を出します",
    help: "寄付の意思表明です。振込先のご案内は準備中で、決まり次第このページと掲示板でお知らせします。",
    placeholder: "例: 1万円くらい / 金額未定でも「出します」だけでOK",
  },
  body: {
    emoji: "🏃",
    label: "体を出す",
    verb: "体を出します",
    help: "現地（西福寺）に行ける日程を書いてください。旅費は寄付金から支給されます。",
    placeholder: "例: 8/20〜8/23 行けます。車あり。力仕事OK",
  },
  goods: {
    emoji: "🍚",
    label: "物資を出す",
    verb: "物資を出します",
    help: "体に優しい食材を募集しています（現地で炊き出しに使います）。送り先: 西福寺 熊本県八代郡氷川町宮原598-1",
    placeholder: "例: お米10kg、味噌2kg を今週中に送れます",
  },
};

/** 私にできる事: 3つの大ボタン + 意思表明一覧 */
export function OffersSection({
  userId,
  requireJoin,
}: {
  userId: string | null;
  requireJoin: () => void;
}) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [formKind, setFormKind] = useState<OfferKind | null>(null);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = () => fetchOffers().then(setOffers);
  useEffect(() => {
    reload();
  }, []);

  const open = (kind: OfferKind) => {
    if (!userId) {
      requireJoin();
      return;
    }
    setFormKind(kind);
    setDetail("");
  };

  const submit = async () => {
    if (!userId || !formKind || !detail.trim()) return;
    setBusy(true);
    await addOffer(userId, formKind, detail.trim());
    setBusy(false);
    setFormKind(null);
    reload();
  };

  return (
    <section className="px-4 py-6 bg-[#f3ecdd]" id="offers">
      <h2 className="text-xl font-bold mb-1">🙋 私にできる事</h2>
      <p className="text-sm text-gray-600 mb-4">
        出せるものをひとつ選んで、意思表明してください
      </p>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {(Object.keys(KINDS) as OfferKind[]).map((k) => (
          <button
            key={k}
            className="rounded-2xl bg-white py-4 shadow-sm active:scale-95 transition-transform"
            onClick={() => open(k)}
          >
            <div className="text-3xl">{KINDS[k].emoji}</div>
            <div className="font-bold text-sm mt-1">{KINDS[k].label}</div>
          </button>
        ))}
      </div>

      {formKind && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setFormKind(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2">
              {KINDS[formKind].emoji} {KINDS[formKind].label}
            </h3>
            <p className="text-sm text-gray-600 mb-3">{KINDS[formKind].help}</p>
            <textarea
              className="w-full rounded-xl border border-gray-300 px-3 py-2 mb-3"
              rows={3}
              placeholder={KINDS[formKind].placeholder}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
            <button
              className="w-full rounded-xl bg-[#d96c2c] py-3 text-white font-bold disabled:opacity-50"
              disabled={busy || !detail.trim()}
              onClick={submit}
            >
              意思表明する
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {offers.map((o) => (
          <div
            key={o.id}
            className="rounded-xl bg-white px-3 py-2 shadow-sm flex items-center gap-3"
          >
            <Avatar
              name={o.profiles?.display_name ?? "参加者"}
              url={o.profiles?.avatar_url}
              size={36}
            />
            <div className="min-w-0">
              <p className="text-sm font-bold">
                {o.profiles?.display_name ?? "参加者"}さんが
                {KINDS[o.kind].verb} {KINDS[o.kind].emoji}
              </p>
              <p className="text-xs text-gray-600 truncate">{o.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

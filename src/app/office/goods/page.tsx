"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/useSession";
import { fetchGoodsOffers, type Offer } from "@/lib/db";
import { GOODS_CATEGORIES, type GoodsCategory } from "@/lib/goodsCategories";
import { ROUTE_LABEL } from "@/components/GoodsSupportBlock";
import { Avatar } from "@/components/Avatar";
import { Lightbox } from "@/components/Lightbox";

/* eslint-disable @next/next/no-img-element */

const ROUTE_SHORT: Record<Offer["route"], string> = {
  orange: "🟠 まとめて送る",
  direct: "🤝 個人間",
  both: "🟠🤝 両方可",
};

/** 事務局: 物資のリスト（画像・数量つき・ジャンル別）。コピーして共有できる */
export default function OfficeGoodsPage() {
  const session = useSession();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lightbox, setLightbox] = useState<{ urls: string[]; idx: number } | null>(null);
  const [showDone, setShowDone] = useState(true);

  useEffect(() => {
    if (!session.isAdmin) return;
    fetchGoodsOffers().then((o) => {
      setOffers(o);
      setLoaded(true);
    });
  }, [session.isAdmin]);

  const groups = useMemo(() => {
    const list = showDone ? offers : offers.filter((o) => !o.done);
    const by = new Map<GoodsCategory, Offer[]>();
    for (const c of GOODS_CATEGORIES) by.set(c.id, []);
    for (const o of list) {
      const cat = (GOODS_CATEGORIES.some((c) => c.id === o.category) ? o.category : "other") as GoodsCategory;
      by.get(cat)!.push(o);
    }
    return GOODS_CATEGORIES.map((c) => ({ cat: c, items: by.get(c.id)! })).filter((g) => g.items.length > 0);
  }, [offers, showDone]);

  const itemName = (o: Offer) => (o.title?.trim() || o.detail.split("\n")[0]).slice(0, 60);

  const copyList = async () => {
    const today = new Date();
    const lines: string[] = [`【わらわ〜ボランティア 物資リスト】${today.getMonth() + 1}/${today.getDate()}時点・${offers.filter((o) => !o.done).length}件（応援完了を除く）`, ""];
    for (const g of groups) {
      const items = g.items.filter((o) => !o.done);
      if (items.length === 0) continue;
      lines.push(`■ ${g.cat.emoji} ${g.cat.short}（${items.length}件）`);
      for (const o of items) {
        const qty = o.quantity?.trim() ? `　数量: ${o.quantity.trim()}` : "";
        const who = `　提供: ${o.profiles?.display_name ?? "参加者"}${o.profiles?.member_no != null ? `（No.${o.profiles.member_no}）` : ""}`;
        lines.push(`・${itemName(o)}${qty}${who}　${ROUTE_SHORT[o.route]}`);
      }
      lines.push("");
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert("コピーできませんでした");
    }
  };

  if (!session.loading && !session.isAdmin) {
    return (
      <main className="p-6 text-center text-sm text-[#a09888]">
        <p className="mb-4">このページは事務局（管理者）専用です。</p>
        <Link href="/" className="font-bold underline" style={{ color: "#d96a1a" }}>← ホームへもどる</Link>
      </main>
    );
  }

  const active = offers.filter((o) => !o.done).length;
  const doneCount = offers.length - active;

  return (
    <main className="min-h-screen pb-24" style={{ background: "#faf6ee" }}>
      <header className="sticky top-0 z-30 border-b border-[#ede5d8] bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="relative flex items-center justify-center">
          <Link href="/office" className="absolute left-0 rounded-full border px-3 py-1 text-[12.5px] font-bold no-underline" style={{ color: "#d96a1a", borderColor: "#f0d0a8", background: "#fff" }}>戻る</Link>
          <span className="text-[14px] font-bold text-[#1c1e21]">📦 物資リスト</span>
        </div>
      </header>

      <div className="px-4 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-bold text-[#5a5448]">
            全{offers.length}件（受付中 {active}件・応援完了 {doneCount}件）
          </p>
          <label className="ml-auto flex items-center gap-1 text-[11.5px] text-[#8a8070]">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> 応援完了も表示
          </label>
        </div>
        <button
          onClick={copyList}
          className="mt-2 w-full rounded-xl py-2.5 text-[13.5px] font-extrabold text-white"
          style={{ background: copied ? "#2e7d4f" : "#d96a1a" }}
        >
          {copied ? "✅ コピーしました" : "📋 リストを文章でコピー（TalK・LINEに貼れる）"}
        </button>

        {!loaded && <p className="py-10 text-center text-sm text-[#a09888]">読み込み中…</p>}
        {loaded && groups.length === 0 && <p className="py-10 text-center text-sm text-[#a09888]">物資の投稿はまだありません</p>}

        {groups.map((g) => (
          <section key={g.cat.id} className="mt-4">
            <h2 className="mb-1.5 text-[13.5px] font-extrabold text-[#c05e14]">
              {g.cat.emoji} {g.cat.short}（{g.items.length}件）
            </h2>
            <div className="overflow-hidden rounded-2xl border border-[#ede5d8] bg-white shadow-sm">
              {g.items.map((o, i) => {
                const thumbs = o.thumb_urls?.length ? o.thumb_urls : o.image_url ? [o.image_url] : [];
                const fulls = o.image_urls?.length ? o.image_urls : o.image_url ? [o.image_url] : [];
                return (
                  <div key={o.id} className={`flex gap-2.5 px-3 py-2.5 ${i > 0 ? "border-t border-[#f0ece0]" : ""} ${o.done ? "opacity-60" : ""}`}>
                    {thumbs.length > 0 ? (
                      <button onClick={() => setLightbox({ urls: fulls, idx: 0 })} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[#ede5d8]">
                        <img src={thumbs[0]} alt="" className="h-full w-full object-cover" />
                        {thumbs.length > 1 && (
                          <span className="num absolute bottom-0 right-0 rounded-tl-md bg-black/55 px-1 text-[9.5px] font-bold text-white">+{thumbs.length - 1}</span>
                        )}
                      </button>
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-[#e0d6c6] text-xl">{g.cat.emoji}</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-1.5">
                        <p className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-[#3a3428]">{itemName(o)}</p>
                        {o.done && <span className="shrink-0 rounded-full bg-[#8a8070] px-1.5 py-0.5 text-[9.5px] font-bold text-white">応援完了</span>}
                      </div>
                      <p className="mt-0.5 text-[12px] leading-snug" style={{ color: o.quantity?.trim() ? "#c05e14" : "#c8c0b0" }}>
                        <span className="font-extrabold">数量:</span> {o.quantity?.trim() || "（記載なし）"}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-[#8a8070]">
                        <Link href={`/u/${o.user_id}`} className="flex items-center gap-1 no-underline text-[#8a8070]">
                          <Avatar name={o.profiles?.display_name ?? "参加者"} url={o.profiles?.avatar_url ?? null} size={16} />
                          <span className="font-bold">{o.profiles?.display_name ?? "参加者"}</span>
                          {o.profiles?.member_no != null && <span className="num">No.{o.profiles.member_no}</span>}
                        </Link>
                        <span title={ROUTE_LABEL[o.route]}>{ROUTE_SHORT[o.route]}</span>
                        {o.route !== "orange" && o.slots > 0 && <span className="num">送り先{o.slots}か所</span>}
                        <Link href={`/post/offer/${o.id}`} className="ml-auto font-bold no-underline" style={{ color: "#d96a1a" }}>投稿を開く →</Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {lightbox && <Lightbox urls={lightbox.urls} index={lightbox.idx} onClose={() => setLightbox(null)} />}
    </main>
  );
}

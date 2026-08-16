/** 物資のジャンル（腸が喜ぶナチュラル食材が中心）。登録時に選ぶ・フィード/候補カルーセルで表示 */
export type GoodsCategory = "rice" | "veg" | "ferment" | "sweets" | "sake" | "daily" | "other";

export const GOODS_CATEGORIES: Array<{ id: GoodsCategory; label: string; short: string; emoji: string; icon: string }> = [
  { id: "rice", label: "有機・自然栽培のお米", short: "お米", emoji: "🌾", icon: "/icons/icon-rice.webp" },
  { id: "veg", label: "有機・自然栽培の野菜・果物", short: "野菜・果物", emoji: "🥕", icon: "/icons/icon-leaf.webp" },
  { id: "ferment", label: "発酵食品・調味料（味噌・漬物・醤油など）", short: "発酵食品", emoji: "🫙", icon: "/icons/icon-rice.webp" },
  { id: "sweets", label: "ナチュラルなお菓子・飲み物", short: "お菓子・飲み物", emoji: "🍪", icon: "/icons/icon-gift.webp" },
  { id: "sake", label: "心に優しいお酒", short: "お酒", emoji: "🍶", icon: "/icons/icon-gift.webp" },
  { id: "daily", label: "日用品・衛生用品（体に優しいもの）", short: "日用品", emoji: "🧴", icon: "/icons/icon-listing.webp" },
  { id: "other", label: "その他", short: "その他", emoji: "📦", icon: "/icons/icon-gift.webp" },
];

export function goodsCategory(id: string | null | undefined) {
  return GOODS_CATEGORIES.find((c) => c.id === id) ?? null;
}

"use client";

/**
 * 県の並び順: 熊本地震対応なので熊本県が先頭・デフォルト。
 * 次に九州各県、あとは北海道から通常順（JIS順）。
 */
const JIS_ORDER = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

const PRIORITY = ["熊本県", "福岡県", "大分県", "鹿児島県", "長崎県", "宮崎県", "佐賀県"];

/** 九州全域フィルタの対象県 */
export const KYUSHU_PREFS = PRIORITY;

export const PREF_ORDER: string[] = [
  ...PRIORITY,
  ...JIS_ORDER.filter((p) => !PRIORITY.includes(p)),
];

export const DEFAULT_PREF = "熊本県";

/** 県→市区町村一覧（OneSeaのdata-municipalities.jsonを1回だけ読み込んでキャッシュ） */
let cache: Promise<Record<string, string[]>> | null = null;

export function fetchMunicipalities(): Promise<Record<string, string[]>> {
  if (!cache) {
    cache = fetch("/data-municipalities.json")
      .then((r) => r.json())
      .then((raw: Record<string, Array<[string, number, number]>>) => {
        const out: Record<string, string[]> = {};
        for (const [pref, rows] of Object.entries(raw)) {
          out[pref] = rows.map((r) => r[0]);
        }
        return out;
      })
      .catch(() => ({}));
  }
  return cache;
}

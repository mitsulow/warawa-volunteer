import type { Metadata } from "next";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";

const SITE = "https://warawa-volunteer.vercel.app";
const DEFAULT_OG = `${SITE}/ogp.png`;

interface Row {
  body?: string;
  detail?: string;
  title?: string | null;
  scope?: string;
  kind?: string;
  pref?: string | null;
  city?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  profiles?: { display_name?: string } | null;
}

/** 投稿1件をREST(anon・公開読み取り)で取り、シェア用のOGP(タイトル・本文・写真)を作る */
async function fetchRow(type: string, id: string): Promise<Row | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const table = type === "board" ? "board_messages" : type === "offer" ? "offers" : null;
  if (!table) return null;
  const cols =
    table === "board_messages"
      ? "body,scope,pref,city,image_url,image_urls,profiles(display_name)"
      : "detail,title,kind,image_url,image_urls,profiles(display_name)";
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}&select=${encodeURIComponent(cols)}`,
      {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        next: { revalidate: 60 },
      }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Row[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}): Promise<Metadata> {
  const { type, id } = await params;
  const row = await fetchRow(type, id);
  if (!row) return {};

  const name = row.profiles?.display_name || "参加者";
  let title: string;
  let text: string;
  if (type === "board") {
    if (row.scope === "voice") {
      const place = [row.pref, row.city && row.city !== "市は不明" ? row.city : null]
        .filter(Boolean)
        .join(" ");
      title = `【助けて】${place ? place + "からの声" : "現地からの声"}｜わらわ〜ボランティア`;
    } else {
      title = `${name}さんの投稿｜わらわ〜ボランティア`;
    }
    text = row.body ?? "";
  } else {
    const head = row.kind === "goods" ? "【物資を出します】" : "【持ち寄ります】";
    title = `${head}${row.title ? row.title : name + "さん"}｜わらわ〜ボランティア`;
    text = row.title ? `${row.title}\n${row.detail ?? ""}` : (row.detail ?? "");
  }
  const description =
    text.replace(/\s+/g, " ").trim().slice(0, 100) || "届けたいのは「大丈夫」、配りたいのは「笑顔」。";
  const image = row.image_urls?.[0] || row.image_url || DEFAULT_OG;
  const url = `${SITE}/post/${type}/${id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "わらわ〜ボランティア",
      images: [{ url: image }],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default function PostLayout({ children }: { children: React.ReactNode }) {
  return children;
}

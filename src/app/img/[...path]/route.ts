import { SUPABASE_URL } from "@/lib/config";

export const runtime = "nodejs";

/**
 * /img/<path> → Supabase Storage(photos) の画像を取ってきて、Vercel CDN に長期キャッシュさせて返す。
 * （外部URLへのrewriteはVercel CDNにキャッシュされないので、関数で s-maxage を付けて返す）
 * これで同じ画像への2回目以降のアクセスは Supabase の転送量を消費しない。
 */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const key = path.map(encodeURIComponent).join("/");
  if (!key || key.includes("..")) return new Response("bad request", { status: 400 });

  const upstream = await fetch(`${SUPABASE_URL}/storage/v1/object/public/photos/${key}`, {
    // Next のfetchキャッシュは使わず（サイズ制限あり）、CDNキャッシュに任せる
    cache: "no-store",
  });
  if (!upstream.ok) return new Response("not found", { status: upstream.status === 404 ? 404 : 502 });

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "image/jpeg");
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  headers.set("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
  headers.set("CDN-Cache-Control", "public, s-maxage=31536000, immutable");
  headers.set("Vercel-CDN-Cache-Control", "public, s-maxage=31536000, immutable");
  return new Response(upstream.body, { status: 200, headers });
}

export const runtime = "nodejs";

/**
 * /r2img/<path> → Cloudflare R2(公開バケット warawa-images) の画像を同一オリジンで返す。
 * pub-….r2.dev は CORS ヘッダを返さない(バケット限定トークンでは設定も不可)ため、
 * Lightbox の「JPEG保存」(canvas変換)はこのプロキシ経由で画像を取得する。
 * /img/(Supabase用) と同じく Vercel CDN に長期キャッシュさせるので、2回目以降は関数実行なし。
 */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const base = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
  if (!base) return new Response("not configured", { status: 503 });

  const { path } = await ctx.params;
  const key = path.map(encodeURIComponent).join("/");
  if (!key || key.includes("..")) return new Response("bad request", { status: 400 });

  const upstream = await fetch(`${base}/${key}`, { cache: "no-store" });
  if (!upstream.ok) return new Response("not found", { status: upstream.status === 404 ? 404 : 502 });
  const type = upstream.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) return new Response("not found", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", type);
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  headers.set("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
  headers.set("CDN-Cache-Control", "public, s-maxage=31536000, immutable");
  headers.set("Vercel-CDN-Cache-Control", "public, s-maxage=31536000, immutable");
  return new Response(upstream.body, { status: 200, headers });
}

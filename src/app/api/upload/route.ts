import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/pushServer";
import { r2Put, r2Ready } from "@/lib/r2";

/**
 * 画像アップロードの受け口（OneSea方式）。クライアントで圧縮済みのWebP/JPEGを受け取り、
 * R2（転送料ゼロ）に保存して公開URLを返す。R2未設定なら 503 → クライアントはSupabase Storageにフォールバック。
 * ログイン必須。1枚あたり最大3MB。
 */
export const runtime = "nodejs";
const MAX = 3 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/avif": "avif",
};

export async function POST(req: Request) {
  if (!r2Ready()) return NextResponse.json({ error: "r2 not configured" }, { status: 503 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const folder = String(form.get("folder") ?? "photos");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "no file" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "too large" }, { status: 413 });
  if (!/^[a-z0-9-]+$/.test(folder)) return NextResponse.json({ error: "bad folder" }, { status: 400 });
  const type = file.type || "image/webp";
  const ext = ALLOWED[type];
  if (!ext) return NextResponse.json({ error: "images only" }, { status: 415 });

  const rand = crypto.randomUUID().slice(0, 8);
  const key = `${folder}/${user.id}/${Date.now()}-${rand}.${ext}`;
  const url = await r2Put(key, new Uint8Array(await file.arrayBuffer()), type);
  if (!url) return NextResponse.json({ error: "upload failed" }, { status: 502 });
  return NextResponse.json({ url });
}

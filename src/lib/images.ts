"use client";

import { createClient } from "@/lib/supabase";

export interface ImagePair {
  full: string;
  thumb: string;
}

/**
 * canvasで縮小圧縮。WebPが作れる端末はWebP（JPEGより約3割軽い）、作れなければJPEG。
 * （HEICはaccept側でJPEG化される端末が多い）
 */
async function compress(file: File, maxW: number, quality: number): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, maxW / bmp.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/webp", quality));
  if (webp && webp.type === "image/webp") return webp;
  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality)
  );
}

/**
 * 1枚を保存して公開URLを返す。
 * まず R2（/api/upload・転送料ゼロ）、R2が未設定/失敗なら Supabase Storage(photos) にフォールバック。
 */
async function putBlob(userId: string, blob: Blob, name: string): Promise<string | null> {
  const supabase = createClient();
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  // 1) R2
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const form = new FormData();
      form.append("file", blob, `${name}.${ext}`);
      form.append("folder", "photos");
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      if (res.ok) {
        const j = (await res.json()) as { url?: string };
        if (j.url) return j.url;
      }
    }
  } catch {}
  // 2) Supabase Storage
  const path = `${userId}/${Date.now()}-${name}.${ext}`;
  const { error } = await supabase.storage.from("photos").upload(path, blob, {
    cacheControl: "31536000",
    contentType: blob.type || "image/jpeg",
  });
  if (error) return null;
  return supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
}

/**
 * サムネ+本体の2枚方式（OneSea CotoZuteと同じ）。
 * フィードはサムネ(560px)で軽く、タップ時は本体(1280px)。
 */
export async function uploadImagePair(userId: string, file: File): Promise<ImagePair | null> {
  try {
    const stamp = Date.now();
    const [fullBlob, thumbBlob] = await Promise.all([
      compress(file, 1280, 0.72),
      compress(file, 560, 0.7),
    ]);
    const [full, thumb] = await Promise.all([
      putBlob(userId, fullBlob, `${stamp}-full`),
      putBlob(userId, thumbBlob, `${stamp}-thumb`),
    ]);
    if (!full || !thumb) return null;
    return { full, thumb };
  } catch {
    return null;
  }
}

/** 1枚だけ（アイコン・カバー・TalKの写真）: 長辺1280に圧縮して保存 */
export async function uploadSingle(userId: string, file: File, maxW = 1280): Promise<string | null> {
  try {
    const blob = await compress(file, maxW, 0.8);
    return await putBlob(userId, blob, `${Date.now()}`);
  } catch {
    return null;
  }
}

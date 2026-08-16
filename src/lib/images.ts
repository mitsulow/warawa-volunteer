"use client";

import { createClient } from "@/lib/supabase";

export interface ImagePair {
  full: string;
  thumb: string;
}

/** canvasで縮小圧縮（HEICはaccept側でJPEG化される端末が多い） */
async function compress(file: File, maxW: number, quality: number): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, maxW / bmp.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality)
  );
}

/**
 * サムネ+本体の2枚方式（OneSea CotoZuteと同じ）。
 * フィードはサムネ(480px)で軽く、タップ時は本体(1280px)。
 */
export async function uploadImagePair(
  userId: string,
  file: File
): Promise<ImagePair | null> {
  try {
    const supabase = createClient();
    const stamp = Date.now();
    const [fullBlob, thumbBlob] = await Promise.all([
      compress(file, 1280, 0.8),
      compress(file, 480, 0.78),
    ]);
    const upload = async (blob: Blob, name: string) => {
      const path = `${userId}/${stamp}-${name}.jpg`;
      const { error } = await supabase.storage.from("photos").upload(path, blob, {
        cacheControl: "31536000",
        contentType: "image/jpeg",
      });
      if (error) return null;
      return supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
    };
    const [full, thumb] = await Promise.all([
      upload(fullBlob, "full"),
      upload(thumbBlob, "thumb"),
    ]);
    if (!full || !thumb) return null;
    return { full, thumb };
  } catch {
    return null;
  }
}

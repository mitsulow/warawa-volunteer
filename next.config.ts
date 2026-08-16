import type { NextConfig } from "next";

/**
 * /img/… → Supabase Storage(photos) へのプロキシ。
 * 画像の配信を Vercel の CDN 経由にして Supabase の転送量(無料枠5GB/月)を節約する。
 * アップロード時に Cache-Control 1年を付けているので、Vercel側でも長期キャッシュされる。
 */
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/img/:path*",
        destination: "https://dmixilrcxiofanwfhxfq.supabase.co/storage/v1/object/public/photos/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/img/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, s-maxage=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;

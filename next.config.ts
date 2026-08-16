import type { NextConfig } from "next";

// 画像は /img/<path> の Route Handler(src/app/img/[...path]/route.ts) が Storage から取ってCDNに長期キャッシュさせる。
// （外部URLへの rewrite は Vercel CDN にキャッシュされないため、関数方式）
const nextConfig: NextConfig = {};

export default nextConfig;

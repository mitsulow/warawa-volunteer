"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** ブラウザ用 Supabase クライアント（cookie + localStorage 併用でモバイルでもセッションが残る） */
export function createClient() {
  if (client) return client;
  client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 400,
      path: "/",
      sameSite: "lax",
      secure:
        typeof window !== "undefined" && window.location.protocol === "https:",
    },
  });
  return client;
}

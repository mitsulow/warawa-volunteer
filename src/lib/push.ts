"use client";

import { createClient } from "@/lib/supabase";
import { VAPID_PUBLIC_KEY } from "@/lib/config";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** 許可済みなら購読してDBに保存（毎回upsertで鮮度を保つ） */
export async function subscribePush(userId: string): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      }));
    const json = sub.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
    const supabase = createClient();
    await supabase.from("push_subscriptions").upsert({
      endpoint: json.endpoint,
      user_id: userId,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    });
    return true;
  } catch {
    return false;
  }
}

/** 通知許可を求めて購読（ボタンから呼ぶ） */
export async function requestAndSubscribe(userId: string): Promise<NotificationPermission> {
  if (!pushSupported()) return "denied";
  const perm = await Notification.requestPermission();
  if (perm === "granted") await subscribePush(userId);
  return perm;
}

/** 送信後の裏側プッシュ発火（失敗しても本文送信には影響させない） */
export async function firePush(path: "/api/push" | "/api/push-group", payload: object) {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {}
}

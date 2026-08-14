import webpush from "web-push";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, VAPID_PUBLIC_KEY } from "@/lib/config";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(
    "mailto:mitsulow@gmail.com",
    VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY!
  );
  configured = true;
}

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Authorizationヘッダーのトークンからユーザーを特定 */
export async function userFromRequest(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const admin = adminClient();
  const {
    data: { user },
  } = await admin.auth.getUser(token);
  return user;
}

interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/** 指定ユーザーの全端末へ送信。無効になった購読は掃除。バッジ数もRPCで同梱 */
export async function sendPushTo(
  admin: SupabaseClient,
  userId: string,
  payload: PushPayload
) {
  ensureConfigured();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs || subs.length === 0) return;

  const { data: unread } = await admin.rpc("unread_total", { uid: userId });
  const body = JSON.stringify({
    ...payload,
    unread: typeof unread === "number" ? unread : undefined,
  });

  await Promise.all(
    (subs as Array<{ endpoint: string; p256dh: string; auth: string }>).map(
      async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body
          );
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
        }
      }
    )
  );
}

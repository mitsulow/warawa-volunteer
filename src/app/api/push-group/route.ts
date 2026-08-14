import { NextResponse } from "next/server";
import { adminClient, sendPushTo, userFromRequest } from "@/lib/pushServer";

export const runtime = "nodejs";

const ROOM: Record<string, string> = {
  voice: "現地からの声",
  board: "みんなの掲示板",
};

/** グループ投稿時: 購読している全参加者(送信者以外)へプッシュ通知 */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { scope, body } = (await req.json()) as { scope?: string; body?: string };
  const room = ROOM[scope ?? ""];
  if (!room) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const admin = adminClient();
  const { data: sender } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("user_id")
    .neq("user_id", user.id);
  const targets = [...new Set(((subs ?? []) as Array<{ user_id: string }>).map((s) => s.user_id))];

  await Promise.all(
    targets.map((t) =>
      sendPushTo(admin, t, {
        title: `${room} — ${sender?.display_name ?? "参加者"}さん`,
        body: (body ?? "").slice(0, 120),
        url: `/talk/g/${scope}`,
        tag: `group-${scope}`,
      })
    )
  );

  return NextResponse.json({ ok: true, sent: targets.length });
}

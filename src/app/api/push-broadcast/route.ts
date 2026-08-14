import { NextResponse } from "next/server";
import { adminClient, sendPushTo, userFromRequest } from "@/lib/pushServer";

export const runtime = "nodejs";

/** 事務局からのお知らせ: 購読している全員へプッシュ通知（送信者は事務局のみ） */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = adminClient();
  const { data: isAdmin } = await admin
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { body } = (await req.json()) as { body?: string };
  if (!body?.trim()) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("user_id")
    .neq("user_id", user.id);
  const targets = [...new Set(((subs ?? []) as Array<{ user_id: string }>).map((s) => s.user_id))];

  await Promise.all(
    targets.map((t) =>
      sendPushTo(admin, t, {
        title: "📢 事務局からのお知らせ",
        body: body.slice(0, 120),
        url: "/talk/broadcast",
        tag: "broadcast",
      })
    )
  );

  return NextResponse.json({ ok: true, sent: targets.length });
}

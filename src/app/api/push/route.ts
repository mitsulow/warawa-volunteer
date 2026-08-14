import { NextResponse } from "next/server";
import { adminClient, sendPushTo, userFromRequest } from "@/lib/pushServer";

export const runtime = "nodejs";

/** DM送信時: 相手にプッシュ通知（送信者本人がchatの参加者であることを検証） */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { chatId, body } = (await req.json()) as { chatId?: string; body?: string };
  if (!chatId) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const admin = adminClient();
  const { data: chat } = await admin
    .from("chats")
    .select("a, b")
    .eq("id", chatId)
    .maybeSingle();
  if (!chat || (chat.a !== user.id && chat.b !== user.id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const target = chat.a === user.id ? (chat.b as string) : (chat.a as string);

  const { data: sender } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  await sendPushTo(admin, target, {
    title: `${sender?.display_name ?? "参加者"}さんからTalK`,
    body: (body ?? "").slice(0, 120),
    url: `/talk/${chatId}`,
    tag: `dm-${chatId}`,
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { adminClient, sendPushTo, userFromRequest } from "@/lib/pushServer";
import { OFFICE_BOT_ID } from "@/lib/config";

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
  if (!chat) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const isParticipant = chat.a === user.id || chat.b === user.id;
  const isOfficeChat = chat.a === OFFICE_BOT_ID || chat.b === OFFICE_BOT_ID;

  // 管理者が「事務局の受信箱」から事務局として送った場合: 差出人=事務局ボット
  let senderId = user.id;
  if (!isParticipant) {
    const { data: adminRow } = await admin.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!adminRow || !isOfficeChat) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    senderId = OFFICE_BOT_ID;
  }
  const target = chat.a === senderId ? (chat.b as string) : (chat.a as string);

  const payload = (title: string) => ({
    title,
    body: (body ?? "").slice(0, 120),
    url: `/talk/${chatId}`,
    tag: `dm-${chatId}`,
  });

  if (target === OFFICE_BOT_ID) {
    // 事務局宛のTalK → 全管理者へ通知（受信箱で読む）
    const { data: sender } = await admin.from("profiles").select("display_name").eq("id", senderId).maybeSingle();
    const { data: admins } = await admin.from("admins").select("user_id");
    await Promise.all(
      ((admins ?? []) as Array<{ user_id: string }>)
        .filter((a) => a.user_id !== senderId)
        .map((a) => sendPushTo(admin, a.user_id, payload(`【事務局宛】${sender?.display_name ?? "参加者"}さんからTalK`)))
    );
    return NextResponse.json({ ok: true, fanout: admins?.length ?? 0 });
  }

  const title =
    senderId === OFFICE_BOT_ID
      ? "事務局からTalKが届いてます"
      : `${(await admin.from("profiles").select("display_name").eq("id", senderId).maybeSingle()).data?.display_name ?? "参加者"}さんからTalK`;
  await sendPushTo(admin, target, payload(title));

  return NextResponse.json({ ok: true });
}

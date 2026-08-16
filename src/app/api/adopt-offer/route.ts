import { NextResponse } from "next/server";
import { adminClient, sendPushTo, userFromRequest } from "@/lib/pushServer";

export const runtime = "nodejs";

/** 事務局アカウント（みつろう） */
const OFFICE_USER_ID = "ef90d04d-99c8-4a8a-967a-5a46f15eedcc";

/**
 * 管理者が物資/その他の投稿を「採用」する。
 * offers.status を confirmed にし、投稿者へ事務局アカウントから自動でTalKを送る（採用時のみ・1投稿1回）。
 * 取り消し(status=open)はTalKを送らない。
 */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = adminClient();
  const { data: adminRow } = await admin
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!adminRow) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { offerId, status } = (await req.json().catch(() => ({}))) as {
    offerId?: string;
    status?: "open" | "confirmed";
  };
  if (!offerId || (status !== "open" && status !== "confirmed")) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const { data: offer } = await admin
    .from("offers")
    .select("id, user_id, kind, title, detail, status")
    .eq("id", offerId)
    .maybeSingle();
  if (!offer) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (offer.kind !== "goods" && offer.kind !== "other") {
    return NextResponse.json({ error: "kind" }, { status: 400 });
  }

  const alreadyConfirmed = offer.status === "confirmed";
  const { error: upErr } = await admin.from("offers").update({ status }).eq("id", offerId);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // 取り消し、または既に採用済み（再送防止）ならTalKは送らない
  if (status !== "confirmed" || alreadyConfirmed) return NextResponse.json({ ok: true });
  if (offer.user_id === OFFICE_USER_ID) return NextResponse.json({ ok: true, skipped: "self" });

  const [a, b] = [offer.user_id as string, OFFICE_USER_ID].sort();
  let chatId: string;
  const { data: existing } = await admin
    .from("chats")
    .select("id")
    .eq("a", a)
    .eq("b", b)
    .maybeSingle();
  if (existing) {
    chatId = existing.id as string;
  } else {
    const { data: created, error } = await admin
      .from("chats")
      .insert({ a, b })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    chatId = created.id as string;
  }

  const { data: prof } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", offer.user_id)
    .maybeSingle();
  const name = prof?.display_name || "参加者";
  const label = ((offer.title as string | null) || (offer.detail as string) || "").trim().slice(0, 40);

  const body =
    `${name}さん、ありがとうございます！\n` +
    `出していただける「${label}」を、現地へ届けたい物資として採用させていただきました。\n\n` +
    `送り先・時期・数量など、詳しいことはこのTalKでご相談させてください。事務局からあらためてご連絡します。`;

  await admin.from("messages").insert({
    chat_id: chatId,
    sender_id: OFFICE_USER_ID,
    body,
  });
  await admin
    .from("chats")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", chatId);

  await sendPushTo(admin, offer.user_id as string, {
    title: "事務局からTalK",
    body: `「${label}」が採用されました！`,
    url: `/talk/${chatId}`,
    tag: `dm-${chatId}`,
  });

  return NextResponse.json({ ok: true, chatId });
}

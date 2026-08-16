import { NextResponse } from "next/server";
import { adminClient, sendPushTo, userFromRequest } from "@/lib/pushServer";

export const runtime = "nodejs";

/** 事務局アカウント（みつろう） */
const OFFICE_USER_ID = "ef90d04d-99c8-4a8a-967a-5a46f15eedcc";

/**
 * 「寄付をする」を押した人へ、事務局アカウントから自動でTalKを送る。
 * 同じ案内は1つのチャットに1回だけ（連打でスパムにならないように）。
 */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.id === OFFICE_USER_ID) return NextResponse.json({ ok: true, skipped: "self" });

  const admin = adminClient();

  // チャットを取得（無ければ作成）
  const [a, b] = [user.id, OFFICE_USER_ID].sort();
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

  const { units: rawUnits, listed } = (await req.json().catch(() => ({}))) as {
    units?: number;
    listed?: boolean;
  };
  const units = Math.min(10000, Math.max(1, Math.floor(Number(rawUnits) || 1)));

  const { data: prof } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const name = prof?.display_name || "参加者";

  // 寄付申込を保管（あとで事務局からメール連絡するため。Google認証のメールアドレスを一緒に保存。管理者だけ閲覧可）
  await admin.from("donations").insert({
    user_id: user.id,
    units,
    amount: units * 1000,
    listed: !!listed,
    email: user.email ?? null,
    display_name: name,
  });

  // 連打対策: 直近10分以内に寄付案内を送っていたら重複送信しない
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: dup } = await admin
    .from("messages")
    .select("id")
    .eq("chat_id", chatId)
    .eq("sender_id", OFFICE_USER_ID)
    .gt("created_at", since)
    .like("body", "%寄付のお申し込みありがとうございます%")
    .limit(1)
    .maybeSingle();
  if (dup) return NextResponse.json({ ok: true, skipped: "already-sent" });

  const body =
    `${name}さん、寄付のお申し込みありがとうございます。\n` +
    `寄付予定 ${units.toLocaleString()}口 ${(units * 1000).toLocaleString()}円です。\n` +
    `以下の口座へお振込みをお願い致します。\n\n` +
    `銀行名　GMOあおぞらネット銀行\n` +
    `支店名　法人第二営業部\n` +
    `口座　　普通 1007941\n` +
    `名義　　ファミュニティリンク カ）\n\n` +
    `※両替手数料の関係上、1口（1,000円）以上からの寄付をお願いしております。\n\n` +
    `《ゆうちょ銀行からの振込手順》\n` +
    `送金 → 他行銀行へのご送金 → 画面指示に従う → 金融機関の選択 → 次を表示 → その他 → 金融機関の選択 → 英字 → GMOあおぞらネット銀行`;

  await admin.from("messages").insert({
    chat_id: chatId,
    sender_id: OFFICE_USER_ID,
    body,
  });
  await admin
    .from("chats")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", chatId);

  await sendPushTo(admin, user.id, {
    title: "事務局からTalK",
    body: "寄付のご案内をお送りしました",
    url: `/talk/${chatId}`,
    tag: `dm-${chatId}`,
  });

  return NextResponse.json({ ok: true });
}

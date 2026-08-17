import { NextResponse } from "next/server";
import { adminClient, sendPushTo, userFromRequest } from "@/lib/pushServer";
import { OFFICE_BOT_ID } from "@/lib/config";

export const runtime = "nodejs";
const SITE = "https://warawa-volunteer.vercel.app";

/** 管理者: 日程調整のリンクを、現地入り立候補者(kind=body)のうち未回答の人へ事務局ボットからTalK+プッシュで送る */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = adminClient();
  const { data: adminRow } = await admin.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { scheduleId } = (await req.json().catch(() => ({}))) as { scheduleId?: string };
  if (!scheduleId) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { data: sched } = await admin.from("schedules").select("id, title, slots").eq("id", scheduleId).maybeSingle();
  if (!sched) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: bodies } = await admin.from("offers").select("user_id").eq("kind", "body");
  const { data: answered } = await admin.from("schedule_answers").select("user_id").eq("schedule_id", scheduleId);
  const done = new Set(((answered ?? []) as Array<{ user_id: string }>).map((a) => a.user_id));
  const targets = Array.from(new Set(((bodies ?? []) as Array<{ user_id: string }>).map((b) => b.user_id))).filter((u) => !done.has(u) && u !== OFFICE_BOT_ID);

  const { data: profs } = await admin.from("profiles").select("id, display_name").in("id", targets.length ? targets : ["00000000-0000-0000-0000-000000000000"]);
  const nameOf = new Map(((profs ?? []) as Array<{ id: string; display_name: string }>).map((p) => [p.id, p.display_name]));
  const slots = ((sched.slots as string[]) ?? []).slice(0, 12).map((s) => `・${s}`).join("\n");
  const url = `${SITE}/schedule/${scheduleId}`;

  let sent = 0;
  for (const uid of targets) {
    const [a, b] = [uid, OFFICE_BOT_ID].sort();
    let chatId: string;
    const { data: existing } = await admin.from("chats").select("id").eq("a", a).eq("b", b).maybeSingle();
    if (existing) chatId = existing.id as string;
    else {
      const { data: created, error } = await admin.from("chats").insert({ a, b }).select("id").single();
      if (error) continue;
      chatId = created.id as string;
    }
    const name = nameOf.get(uid) || "参加者";
    const body =
      `${name}さん、現地入りへの立候補ありがとうございます。\n` +
      `現地入りメンバーの選考のため、事務局とZoomで面談をお願いしたく、日程を調整させてください。\n\n` +
      `【${sched.title}】\n${slots}\n\n` +
      `▼ 都合の良い日時に ○△× を付けてください（1分で終わります）\n${url}\n\n` +
      `よろしくお願い致します。`;
    await admin.from("messages").insert({ chat_id: chatId, sender_id: OFFICE_BOT_ID, body });
    await admin.from("chats").update({ last_message_at: new Date().toISOString() }).eq("id", chatId);
    await sendPushTo(admin, uid, { title: "事務局からTalKが届いてます", body: "Zoom面談の日程調整のお願い", url: `/talk/${chatId}`, tag: `dm-${chatId}` });
    sent++;
  }
  return NextResponse.json({ ok: true, sent, targets: targets.length });
}

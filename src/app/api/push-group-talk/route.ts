import { NextResponse } from "next/server";
import { adminClient, sendPushTo, userFromRequest } from "@/lib/pushServer";

export const runtime = "nodejs";

/** グループTalK送信時: 送信者以外のメンバーへプッシュ（送信者がメンバー or 管理者であることを検証）。invite=招待した人だけに送る */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { groupId, body, invite } = (await req.json().catch(() => ({}))) as { groupId?: string; body?: string; invite?: string[] };
  if (!groupId) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const admin = adminClient();
  const [{ data: group }, { data: members }, { data: adminRow }] = await Promise.all([
    admin.from("groups").select("id, name").eq("id", groupId).maybeSingle(),
    admin.from("group_members").select("user_id").eq("group_id", groupId),
    admin.from("admins").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!group) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ids = ((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id);
  if (!ids.includes(user.id) && !adminRow) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: sender } = await admin.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const senderName = sender?.display_name ?? "参加者";
  const targets = (Array.isArray(invite) && invite.length ? invite.filter((u) => ids.includes(u)) : ids).filter((u) => u !== user.id);
  const isInvite = Array.isArray(invite) && invite.length > 0;
  await Promise.all(
    targets.map((uid) =>
      sendPushTo(admin, uid, {
        title: isInvite ? `グループ「${group.name}」に招待されました` : `${group.name}：${senderName}さん`,
        body: (body ?? "").slice(0, 120),
        url: `/talk/group/${groupId}`,
        tag: `group-${groupId}`,
      })
    )
  );
  return NextResponse.json({ ok: true, fanout: targets.length });
}

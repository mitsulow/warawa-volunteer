// グループ招待のプッシュを手動で送る（事務局UIを使わずSQLで招待した時用）
// usage: node scripts/_push_group_invite.mjs <groupId> [title] [body]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const REF = "dmixilrcxiofanwfhxfq";
const envOf = (file) =>
  Object.fromEntries(
    fs
      .readFileSync(path.join(os.homedir(), file), "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
  );
const w = envOf(".warawa-env");
const r = envOf(".rakuichi-env");
const [groupId, title, body] = process.argv.slice(2);
if (!groupId) throw new Error("groupId required");

const keysRes = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, {
  headers: { Authorization: `Bearer ${r.SUPABASE_ACCESS_TOKEN}`, "User-Agent": "warawa-script" },
});
const keys = await keysRes.json();
const service = keys.find((k) => k.name === "service_role").api_key;
const admin = createClient(`https://${REF}.supabase.co`, service, { auth: { persistSession: false } });

webpush.setVapidDetails("mailto:mitsulow@gmail.com", w.VAPID_PUBLIC_KEY, w.VAPID_PRIVATE_KEY);

const { data: group } = await admin.from("groups").select("name").eq("id", groupId).single();
const { data: members } = await admin.from("group_members").select("user_id, role").eq("group_id", groupId);
const { data: admins } = await admin.from("admins").select("user_id");
const adminSet = new Set(admins.map((a) => a.user_id));
const targets = members.filter((m) => !adminSet.has(m.user_id)).map((m) => m.user_id);
console.log("group:", group.name, "targets:", targets.length);

let sent = 0, gone = 0, noSub = 0;
for (const uid of targets) {
  const { data: subs } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", uid);
  if (!subs || subs.length === 0) { noSub++; continue; }
  const { data: unread } = await admin.rpc("unread_total", { uid });
  const payload = JSON.stringify({
    title: title || `グループ「${group.name}」に招待されました`,
    body: body || "Zoom説明会の日程調整（○△×）をお願いします",
    url: `/talk/group/${groupId}`,
    tag: `group-${groupId}`,
    unread: typeof unread === "number" ? unread : undefined,
  });
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        gone++;
      } else console.error("push error", uid, e.statusCode, e.body?.slice?.(0, 100));
    }
  }
}
console.log({ sent, gone, noSub });

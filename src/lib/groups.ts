"use client";

import { createClient } from "@/lib/supabase";
import { cdnify, ensureProfile } from "@/lib/db";
import { firePush } from "@/lib/push";

/** グループTalK（LINEグループ相当）。kind='schedule' は日程調整グループ（調整くんをトップに固定） */
export interface Group {
  id: string;
  name: string;
  description: string | null;
  kind: "normal" | "schedule";
  schedule_id: string | null;
  created_by: string | null;
  created_at: string;
}
export interface GroupMember {
  group_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  last_read_at: string;
  profiles: { display_name: string; avatar_url: string | null; member_no: number | null } | null;
}
export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string | null;
  body: string;
  image_url: string | null;
  system: boolean;
  created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
}
export interface GroupSummary extends Group {
  memberCount: number;
  lastBody: string | null;
  lastAt: string | null;
  unread: number;
}

const MSG_SELECT = "id, group_id, sender_id, body, image_url, system, created_at, profiles(display_name, avatar_url)";

/** 自分が入っているグループ一覧（未読数・最後の1通つき） */
export async function fetchMyGroups(myId: string): Promise<GroupSummary[]> {
  const supabase = createClient();
  const { data: mem } = await supabase.from("group_members").select("group_id, last_read_at").eq("user_id", myId);
  const rows = (mem ?? []) as Array<{ group_id: string; last_read_at: string }>;
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.group_id);
  const lastReadBy = new Map(rows.map((r) => [r.group_id, r.last_read_at]));
  const [{ data: gs }, { data: counts }] = await Promise.all([
    supabase.from("groups").select("*").in("id", ids),
    supabase.from("group_members").select("group_id").in("group_id", ids),
  ]);
  const cnt = new Map<string, number>();
  for (const c of (counts ?? []) as Array<{ group_id: string }>) cnt.set(c.group_id, (cnt.get(c.group_id) ?? 0) + 1);
  const out: GroupSummary[] = [];
  for (const g of (gs ?? []) as Group[]) {
    const [{ data: last }, { count: unread }] = await Promise.all([
      supabase.from("group_messages").select("body, created_at, system").eq("group_id", g.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase
        .from("group_messages")
        .select("id", { count: "exact", head: true })
        .eq("group_id", g.id)
        .gt("created_at", lastReadBy.get(g.id) ?? "1970-01-01")
        .neq("sender_id", myId),
    ]);
    out.push({
      ...g,
      memberCount: cnt.get(g.id) ?? 0,
      lastBody: (last as { body?: string } | null)?.body ?? null,
      lastAt: (last as { created_at?: string } | null)?.created_at ?? g.created_at,
      unread: unread ?? 0,
    });
  }
  return out.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
}

export async function fetchGroup(id: string): Promise<Group | null> {
  const supabase = createClient();
  const { data } = await supabase.from("groups").select("*").eq("id", id).maybeSingle();
  return (data as Group | null) ?? null;
}

export async function fetchGroupMembers(id: string): Promise<GroupMember[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("group_members")
    .select("group_id, user_id, role, joined_at, last_read_at, profiles(display_name, avatar_url, member_no)")
    .eq("group_id", id)
    .order("joined_at", { ascending: true })
    .limit(500);
  return cdnify((data as unknown as GroupMember[]) ?? []);
}

export async function fetchGroupMessages(id: string): Promise<GroupMessage[]> {
  const supabase = createClient();
  const { data } = await supabase.from("group_messages").select(MSG_SELECT).eq("group_id", id).order("created_at", { ascending: true }).limit(300);
  return cdnify((data as unknown as GroupMessage[]) ?? []);
}

export async function fetchGroupMessagesSince(id: string, sinceIso: string): Promise<GroupMessage[]> {
  const supabase = createClient();
  const { data } = await supabase.from("group_messages").select(MSG_SELECT).eq("group_id", id).gt("created_at", sinceIso).order("created_at", { ascending: true }).limit(300);
  return cdnify((data as unknown as GroupMessage[]) ?? []);
}

export async function sendGroupMessage(groupId: string, myId: string, body: string, imageUrl?: string | null) {
  await ensureProfile(myId);
  const supabase = createClient();
  const result = await supabase.from("group_messages").insert({ group_id: groupId, sender_id: myId, body, image_url: imageUrl ?? null });
  if (!result.error) firePush("/api/push-group-talk", { groupId, body: body || "📷 写真" });
  return result;
}

export async function deleteGroupMessage(id: string) {
  const supabase = createClient();
  return supabase.from("group_messages").delete().eq("id", id);
}

export async function markGroupTalkRead(groupId: string, myId: string) {
  const supabase = createClient();
  await supabase.from("group_members").update({ last_read_at: new Date().toISOString() }).eq("group_id", groupId).eq("user_id", myId);
  window.dispatchEvent(new Event("warawa:unreadRefresh"));
}

export async function leaveGroup(groupId: string, myId: string) {
  const supabase = createClient();
  return supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", myId);
}

/* ---- 管理者 ---- */
export async function fetchAllGroups(): Promise<Group[]> {
  const supabase = createClient();
  const { data } = await supabase.from("groups").select("*").order("created_at", { ascending: false }).limit(100);
  return (data as Group[]) ?? [];
}

export async function createGroup(userId: string, name: string, description: string, kind: Group["kind"], scheduleId?: string | null) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("groups")
    .insert({ name, description: description || null, kind, schedule_id: scheduleId ?? null, created_by: userId })
    .select("id")
    .single();
  if (!error && data) {
    await supabase.from("group_members").insert({ group_id: data.id, user_id: userId, role: "owner" });
    await supabase.from("group_messages").insert({ group_id: data.id, sender_id: userId, body: `グループ「${name}」を作成しました`, system: true });
  }
  return { data, error };
}

/** メンバー追加（管理者/オーナー）。既存はスキップ。参加のシステムメッセージを1つ入れる */
export async function addGroupMembers(groupId: string, userIds: string[], byUserId: string): Promise<number> {
  const supabase = createClient();
  const { data: existing } = await supabase.from("group_members").select("user_id").eq("group_id", groupId);
  const have = new Set(((existing ?? []) as Array<{ user_id: string }>).map((e) => e.user_id));
  const fresh = Array.from(new Set(userIds)).filter((u) => !have.has(u));
  if (fresh.length === 0) return 0;
  const { error } = await supabase.from("group_members").insert(fresh.map((u) => ({ group_id: groupId, user_id: u, role: "member" })));
  if (error) return 0;
  await supabase.from("group_messages").insert({ group_id: groupId, sender_id: byUserId, body: `${fresh.length}人が参加しました`, system: true });
  firePush("/api/push-group-talk", { groupId, body: "グループに招待されました", invite: fresh });
  return fresh.length;
}

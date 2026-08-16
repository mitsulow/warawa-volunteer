import { createClient } from "@/lib/supabase";

/**
 * 🔔 お知らせ（OneSea準拠）。DBトリガーが notifications に自動で積む:
 *  comment = 自分の投稿にコメントが付いた
 * 既読は「タップした分だけ」（一覧を開いた瞬間の全既読は
 * 1つ潰すと全部消えるバグの温床なのでOneSea同様やらない）
 */
export interface NotificationRow {
  id: string;
  actor_id: string | null;
  kind: string;
  target_url: string | null;
  excerpt: string | null;
  created_at: string;
  read_at: string | null;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
}

export function notifText(n: NotificationRow): string {
  const who = n.profiles?.display_name ?? "どなたか";
  switch (n.kind) {
    case "comment":
      return `${who}さんがあなたの投稿にコメントしました`;
    case "friend_request":
      return `${who}さんから友達申請が届きました`;
    case "friend_accept":
      return `${who}さんが友達申請を承認しました`;
    case "goods_request":
      return `${who}さんが物資の受け取りを希望しています`;
    case "voice_support":
      return `${who}さんが「私が応援します」と手を挙げました`;
    case "voice_accept":
      return `${who}さんがあなたに応援をお願いしました`;
    case "goods_accept":
      return `${who}さんが物資の受け取り相手にあなたを選びました`;
    default:
      return `${who}さんからお知らせがあります`;
  }
}

export async function fetchNotifications(userId: string, limit = 60): Promise<NotificationRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("notifications")
    .select(
      "id, actor_id, kind, target_url, excerpt, created_at, read_at, profiles!notifications_actor_id_fkey(display_name, avatar_url)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as unknown as NotificationRow[]) ?? [];
}

export async function fetchNotifUnread(userId: string): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

/** 個別既読: 見た(タップした)お知らせだけを既読にする */
export async function markNotifRead(userId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const supabase = createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("id", ids)
    .is("read_at", null);
}

export async function markNotifsRead(userId: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
}

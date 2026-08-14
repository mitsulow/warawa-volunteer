"use client";

import { createClient } from "@/lib/supabase";
import { firePush } from "@/lib/push";

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  sns: Record<string, string> | null;
  member_no: number | null;
  created_at: string;
}

const PROFILE_SELECT =
  "id, display_name, avatar_url, cover_url, bio, sns, member_no, created_at";

export type OfferKind = "money" | "body" | "goods";

export interface Offer {
  id: string;
  user_id: string;
  kind: OfferKind;
  title: string | null;
  detail: string;
  image_url: string | null;
  status: "open" | "confirmed" | "done";
  created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

export type BoardScope = "board" | "voice";

export interface BoardMessage {
  id: string;
  user_id: string;
  body: string;
  image_url: string | null;
  scope: BoardScope;
  created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

export interface DmMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string;
  image_url: string | null;
  read_at: string | null;
  created_at: string;
}

/* ---------- profile ---------- */

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  return fetchProfile(userId);
}

export async function upsertMyProfile(
  userId: string,
  patch: Partial<Omit<Profile, "id" | "created_at" | "member_no">>
) {
  const supabase = createClient();
  return supabase.from("profiles").upsert({ id: userId, ...patch });
}

export async function fetchMembers(): Promise<Profile[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .order("member_no", { ascending: true })
    .limit(500);
  return (data as Profile[]) ?? [];
}

/** 連絡用メール（profile_private: 本人+管理者のみ閲覧可） */
export async function saveMyEmail(userId: string, email: string) {
  const supabase = createClient();
  return supabase.from("profile_private").upsert({ id: userId, email });
}

export async function fetchMyPrivate(
  userId: string
): Promise<{ phone: string | null; email: string | null }> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profile_private")
    .select("phone, email")
    .eq("id", userId)
    .maybeSingle();
  return {
    phone: (data?.phone as string | null) ?? null,
    email: (data?.email as string | null) ?? null,
  };
}

export async function saveMyPrivate(userId: string, phone: string, email: string) {
  const supabase = createClient();
  return supabase.from("profile_private").upsert({ id: userId, phone, email });
}

/* ---------- 事務局: 現地入り申請 ---------- */

export interface BodyApplication {
  id: string;
  user_id: string;
  detail: string;
  status: "open" | "confirmed" | "done";
  created_at: string;
  profiles: {
    display_name: string;
    avatar_url: string | null;
    member_no: number | null;
    sns: Record<string, string> | null;
    profile_private: { phone: string | null; email: string | null } | null;
  } | null;
}

/** 体を出す申請一覧（電話・メールは管理者RLSでのみ返る） */
export async function fetchBodyApplications(): Promise<BodyApplication[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("offers")
    .select(
      "id, user_id, detail, status, created_at, profiles(display_name, avatar_url, member_no, sns, profile_private(phone, email))"
    )
    .eq("kind", "body")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data as unknown as BodyApplication[]) ?? [];
}

export async function fetchMyEmail(userId: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profile_private")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  return (data?.email as string | null) ?? null;
}

export async function fetchIsAdmin(userId: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/* ---------- offers（私にできる事） ---------- */

const OFFER_SELECT =
  "id, user_id, kind, title, detail, image_url, status, created_at, profiles(display_name, avatar_url)";

export async function fetchOffers(): Promise<Offer[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("offers")
    .select(OFFER_SELECT)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data as unknown as Offer[]) ?? [];
}

export async function fetchOffersByUser(userId: string): Promise<Offer[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("offers")
    .select(OFFER_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data as unknown as Offer[]) ?? [];
}

export async function addOffer(
  userId: string,
  kind: OfferKind,
  detail: string,
  title?: string | null,
  imageUrl?: string | null
) {
  const supabase = createClient();
  return supabase.from("offers").insert({
    user_id: userId,
    kind,
    detail,
    title: title ?? null,
    image_url: imageUrl ?? null,
  });
}

export async function setOfferStatus(id: string, status: Offer["status"]) {
  const supabase = createClient();
  return supabase.from("offers").update({ status }).eq("id", id);
}

/** オレンジ軍団: 現地に行くことが決まった人（body offerがconfirmed） */
export async function fetchOrangeCorps(): Promise<Profile[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("offers")
    .select("user_id, profiles(id, display_name, avatar_url, cover_url, bio, sns, member_no, created_at)")
    .eq("kind", "body")
    .eq("status", "confirmed")
    .order("created_at", { ascending: true })
    .limit(60);
  const seen = new Set<string>();
  const out: Profile[] = [];
  for (const r of (data ?? []) as unknown as Array<{ user_id: string; profiles: Profile | null }>) {
    if (r.profiles && !seen.has(r.user_id)) {
      seen.add(r.user_id);
      out.push(r.profiles);
    }
  }
  return out;
}

/* ---------- グループ掲示板（board=みんなの掲示板 / voice=現地からの声。Talkと同期） ---------- */

const BOARD_SELECT =
  "id, user_id, body, image_url, scope, created_at, profiles(display_name, avatar_url)";

export async function fetchBoard(scope: BoardScope): Promise<BoardMessage[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("board_messages")
    .select(BOARD_SELECT)
    .eq("scope", scope)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data as unknown as BoardMessage[]) ?? [];
}

/** cursor(=最後に受け取ったcreated_at)より後の新着だけを取る（増分取得の鉄則） */
export async function fetchBoardSince(
  scope: BoardScope,
  sinceIso: string
): Promise<BoardMessage[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("board_messages")
    .select(BOARD_SELECT)
    .eq("scope", scope)
    .gt("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data as unknown as BoardMessage[]) ?? [];
}

export async function sendBoardMessage(
  scope: BoardScope,
  userId: string,
  body: string,
  imageUrl?: string | null
) {
  const supabase = createClient();
  const result = await supabase
    .from("board_messages")
    .insert({ scope, user_id: userId, body, image_url: imageUrl ?? null });
  if (!result.error) {
    firePush("/api/push-group", { scope, body: body || "📷 写真" });
  }
  return result;
}

export async function markGroupRead(scope: BoardScope, userId: string) {
  const supabase = createClient();
  await supabase
    .from("group_reads")
    .upsert({ user_id: userId, scope, last_read_at: new Date().toISOString() });
  window.dispatchEvent(new Event("warawa:unreadRefresh"));
}

/** グループ2部屋の最新+未読（Talk一覧のピン留め行用） */
export async function fetchGroupSummaries(userId: string): Promise<
  Record<BoardScope, { lastBody: string | null; lastAt: string | null; unread: number }>
> {
  const supabase = createClient();
  const [{ data: msgs }, { data: reads }] = await Promise.all([
    supabase
      .from("board_messages")
      .select("scope, user_id, body, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("group_reads").select("scope, last_read_at").eq("user_id", userId),
  ]);
  const readBy = new Map(
    ((reads ?? []) as Array<{ scope: string; last_read_at: string }>).map((r) => [
      r.scope,
      r.last_read_at,
    ])
  );
  const out: Record<string, { lastBody: string | null; lastAt: string | null; unread: number }> = {
    board: { lastBody: null, lastAt: null, unread: 0 },
    voice: { lastBody: null, lastAt: null, unread: 0 },
  };
  for (const m of (msgs ?? []) as Array<{
    scope: string;
    user_id: string;
    body: string;
    created_at: string;
  }>) {
    const o = out[m.scope];
    if (!o) continue;
    if (!o.lastAt) {
      o.lastAt = m.created_at;
      o.lastBody = m.body;
    }
    const lr = readBy.get(m.scope);
    if (m.user_id !== userId && (!lr || m.created_at > lr)) o.unread++;
  }
  return out as Record<BoardScope, { lastBody: string | null; lastAt: string | null; unread: number }>;
}

/* ---------- 1対1 Talk ---------- */

export async function getOrCreateChat(
  myId: string,
  otherId: string
): Promise<string | null> {
  const supabase = createClient();
  const [a, b] = [myId, otherId].sort();
  const { data: existing } = await supabase
    .from("chats")
    .select("id")
    .eq("a", a)
    .eq("b", b)
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await supabase
    .from("chats")
    .insert({ a, b })
    .select("id")
    .single();
  if (error) return null;
  return data.id as string;
}

export async function fetchChatPartner(
  chatId: string,
  myId: string
): Promise<Profile | null> {
  const supabase = createClient();
  const { data: chat } = await supabase
    .from("chats")
    .select("a, b")
    .eq("id", chatId)
    .maybeSingle();
  if (!chat) return null;
  const partnerId = chat.a === myId ? (chat.b as string) : (chat.a as string);
  return fetchProfile(partnerId);
}

const DM_SELECT = "id, chat_id, sender_id, body, image_url, read_at, created_at";

export async function fetchDm(chatId: string): Promise<DmMessage[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("messages")
    .select(DM_SELECT)
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data as DmMessage[]) ?? [];
}

export async function fetchDmSince(
  chatId: string,
  sinceIso: string
): Promise<DmMessage[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("messages")
    .select(DM_SELECT)
    .eq("chat_id", chatId)
    .gt("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data as DmMessage[]) ?? [];
}

export async function sendDm(chatId: string, myId: string, body: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("messages")
    .insert({ chat_id: chatId, sender_id: myId, body });
  if (!error) {
    await supabase
      .from("chats")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", chatId);
    firePush("/api/push", { chatId, body });
  }
  return { error };
}

export async function markDmRead(chatId: string, myId: string) {
  const supabase = createClient();
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("chat_id", chatId)
    .is("read_at", null)
    .neq("sender_id", myId);
  window.dispatchEvent(new Event("warawa:unreadRefresh"));
}

/* ---------- Talk一覧 ---------- */

interface ChatRow {
  id: string;
  a: string;
  b: string;
  last_message_at: string | null;
  pa: { display_name: string; avatar_url: string | null } | null;
  pb: { display_name: string; avatar_url: string | null } | null;
}

export interface ChatSummary {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  lastBody: string | null;
  lastAt: string | null;
  unread: number;
}

export async function fetchChatList(myId: string): Promise<ChatSummary[]> {
  const supabase = createClient();
  const { data: chats } = await supabase
    .from("chats")
    .select(
      "id, a, b, last_message_at, pa:profiles!chats_a_fkey(display_name, avatar_url), pb:profiles!chats_b_fkey(display_name, avatar_url)"
    )
    .or(`a.eq.${myId},b.eq.${myId}`)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  const rows = (chats as unknown as ChatRow[]) ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((c) => c.id);
  const [{ data: lasts }, { data: unreads }] = await Promise.all([
    supabase
      .from("messages")
      .select("chat_id, body, created_at")
      .in("chat_id", ids)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("messages")
      .select("chat_id")
      .in("chat_id", ids)
      .is("read_at", null)
      .neq("sender_id", myId),
  ]);
  const lastBy = new Map<string, { body: string; created_at: string }>();
  for (const m of lasts ?? []) {
    if (!lastBy.has(m.chat_id)) lastBy.set(m.chat_id, m);
  }
  const unreadBy = new Map<string, number>();
  for (const m of unreads ?? []) {
    unreadBy.set(m.chat_id, (unreadBy.get(m.chat_id) ?? 0) + 1);
  }

  return rows.map((c) => {
    const partnerIsA = c.b === myId;
    const partner = (partnerIsA ? c.pa : c.pb) ?? {
      display_name: "参加者",
      avatar_url: null,
    };
    const last = lastBy.get(c.id);
    return {
      id: c.id,
      partnerId: partnerIsA ? c.a : c.b,
      partnerName: partner.display_name || "参加者",
      partnerAvatar: partner.avatar_url,
      lastBody: last?.body ?? null,
      lastAt: last?.created_at ?? c.last_message_at,
      unread: unreadBy.get(c.id) ?? 0,
    };
  });
}

/** ナビバッジ用: DM未読 + グループ未読の合計 */
export async function fetchUnreadTotal(myId: string): Promise<number> {
  const supabase = createClient();
  const [{ count }, groups] = await Promise.all([
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
      .neq("sender_id", myId),
    fetchGroupSummaries(myId).catch(() => null),
  ]);
  const g = groups ? groups.board.unread + groups.voice.unread : 0;
  return (count ?? 0) + g;
}

/* ---------- 管理者の管理 ---------- */

export async function fetchAdminIds(): Promise<Set<string>> {
  const supabase = createClient();
  const { data } = await supabase.from("admins").select("user_id");
  return new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id));
}

export async function addAdmin(userId: string) {
  const supabase = createClient();
  return supabase.from("admins").insert({ user_id: userId });
}

export async function removeAdmin(userId: string) {
  const supabase = createClient();
  return supabase.from("admins").delete().eq("user_id", userId);
}

/* ---------- 画像アップロード（Supabase Storage） ---------- */

export async function uploadPhoto(file: File, userId: string): Promise<string | null> {
  const supabase = createClient();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("photos").upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) return null;
  const { data } = supabase.storage.from("photos").getPublicUrl(path);
  return data.publicUrl;
}

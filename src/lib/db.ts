"use client";

import { createClient } from "@/lib/supabase";

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Need {
  id: string;
  author: string | null;
  title: string;
  body: string | null;
  status: "open" | "doing" | "done";
  created_at: string;
}

export type OfferKind = "money" | "body" | "goods";

export interface Offer {
  id: string;
  user_id: string;
  kind: OfferKind;
  detail: string;
  status: string;
  created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

export interface BoardMessage {
  id: string;
  user_id: string;
  body: string;
  image_url: string | null;
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

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, created_at")
    .eq("id", userId)
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function upsertMyProfile(userId: string, displayName: string) {
  const supabase = createClient();
  return supabase
    .from("profiles")
    .upsert({ id: userId, display_name: displayName });
}

export async function fetchMembers(): Promise<Profile[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, created_at")
    .order("created_at", { ascending: true })
    .limit(500);
  return (data as Profile[]) ?? [];
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

/* ---------- needs（現地の要望） ---------- */

export async function fetchNeeds(): Promise<Need[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("needs")
    .select("id, author, title, body, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data as Need[]) ?? [];
}

export async function addNeed(author: string, title: string, body: string) {
  const supabase = createClient();
  return supabase.from("needs").insert({ author, title, body });
}

export async function setNeedStatus(id: string, status: Need["status"]) {
  const supabase = createClient();
  return supabase.from("needs").update({ status }).eq("id", id);
}

/* ---------- offers（私にできる事） ---------- */

export async function fetchOffers(): Promise<Offer[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("offers")
    .select(
      "id, user_id, kind, detail, status, created_at, profiles(display_name, avatar_url)"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  return (data as unknown as Offer[]) ?? [];
}

export async function addOffer(userId: string, kind: OfferKind, detail: string) {
  const supabase = createClient();
  return supabase.from("offers").insert({ user_id: userId, kind, detail });
}

/* ---------- board（掲示板 = グループTalk。増分取得が鉄則） ---------- */

const BOARD_SELECT =
  "id, user_id, body, image_url, created_at, profiles(display_name, avatar_url)";

export async function fetchBoard(): Promise<BoardMessage[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("board_messages")
    .select(BOARD_SELECT)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data as unknown as BoardMessage[]) ?? [];
}

/** cursor(=最後に受け取ったcreated_at)より後の新着だけを取る */
export async function fetchBoardSince(sinceIso: string): Promise<BoardMessage[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("board_messages")
    .select(BOARD_SELECT)
    .gt("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data as unknown as BoardMessage[]) ?? [];
}

export async function sendBoardMessage(
  userId: string,
  body: string,
  imageUrl?: string | null
) {
  const supabase = createClient();
  return supabase
    .from("board_messages")
    .insert({ user_id: userId, body, image_url: imageUrl ?? null });
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
  return fetchMyProfile(partnerId);
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

/** 自分のTalk一覧（相手・最新メッセージ・未読数つき。OneSea方式） */
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

"use client";

import { createClient } from "@/lib/supabase";
import { cdnify, ensureProfile } from "@/lib/db";

/** 調整さん風の日程調整（事務局が作成 → 参加者が ○△× を付ける） */
export interface Schedule {
  id: string;
  title: string;
  description: string | null;
  slots: string[]; // 「8/18(火) 11:00〜」など
  created_by: string | null;
  closed: boolean;
  created_at: string;
}
export type Mark = "o" | "d" | "x"; // ○ △ ×
export interface ScheduleAnswer {
  id: string;
  schedule_id: string;
  user_id: string;
  answers: Record<string, Mark>; // key = slot index
  comment: string | null;
  updated_at: string;
  profiles: { display_name: string; avatar_url: string | null; member_no: number | null } | null;
}

export async function fetchSchedules(): Promise<Schedule[]> {
  const supabase = createClient();
  const { data } = await supabase.from("schedules").select("*").order("created_at", { ascending: false }).limit(50);
  return (data as Schedule[]) ?? [];
}

export async function fetchSchedule(id: string): Promise<Schedule | null> {
  const supabase = createClient();
  const { data } = await supabase.from("schedules").select("*").eq("id", id).maybeSingle();
  return (data as Schedule | null) ?? null;
}

export async function createSchedule(userId: string, title: string, description: string, slots: string[]) {
  const supabase = createClient();
  return supabase.from("schedules").insert({ title, description: description || null, slots, created_by: userId }).select("id").single();
}

export async function setScheduleClosed(id: string, closed: boolean) {
  const supabase = createClient();
  return supabase.from("schedules").update({ closed }).eq("id", id);
}

export async function fetchAnswers(scheduleId: string): Promise<ScheduleAnswer[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("schedule_answers")
    .select("id, schedule_id, user_id, answers, comment, updated_at, profiles(display_name, avatar_url, member_no)")
    .eq("schedule_id", scheduleId)
    .order("updated_at", { ascending: true })
    .limit(500);
  return cdnify((data as unknown as ScheduleAnswer[]) ?? []);
}

export async function saveAnswer(scheduleId: string, userId: string, answers: Record<string, Mark>, comment: string) {
  await ensureProfile(userId);
  const supabase = createClient();
  return supabase
    .from("schedule_answers")
    .upsert({ schedule_id: scheduleId, user_id: userId, answers, comment: comment.trim() || null, updated_at: new Date().toISOString() }, { onConflict: "schedule_id,user_id" });
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/useSession";
import {
  fetchBodyApplications,
  fetchReports,
  resolveReport,
  setOfferStatus,
  type BodyApplication,
  type PostReport,
} from "@/lib/db";
import { Avatar } from "@/components/Avatar";
import { AdminSection } from "@/components/AdminSection";
import { SnsIcon } from "@/components/SnsIcon";
import { BottomNav } from "@/components/BottomNav";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 🏛 事務局ページ（管理者のみ）。現地入り申請の確認と決定、管理者の管理 */
export default function OfficePage() {
  const session = useSession();
  const [apps, setApps] = useState<BodyApplication[]>([]);
  const [reports, setReports] = useState<PostReport[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = () => {
    fetchBodyApplications().then(setApps);
    fetchReports().then(setReports);
  };
  useEffect(() => {
    if (session.isAdmin) reload();
  }, [session.isAdmin]);

  const toggle = async (a: BodyApplication) => {
    setBusy(a.id);
    await setOfferStatus(a.id, a.status === "confirmed" ? "open" : "confirmed");
    setBusy(null);
    reload();
  };

  if (!session.loading && !session.isAdmin) {
    return (
      <main className="min-h-screen p-6 text-center" style={{ background: "#faf6ee" }}>
        <p className="mt-10 text-sm text-[#8a8070]">
          このページは事務局（管理者）専用です。
        </p>
        <Link href="/" className="mt-4 inline-block font-bold underline" style={{ color: "#d96a1a" }}>
          ← ホームへもどる
        </Link>
      </main>
    );
  }

  const open = apps.filter((a) => a.status === "open");
  const confirmed = apps.filter((a) => a.status === "confirmed");

  const card = (a: BodyApplication) => {
    const p = a.profiles;
    const priv = p?.profile_private;
    return (
      <div key={a.id} className="rounded-xl border border-[#ede5d8] bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Link href={`/u/${a.user_id}`}>
            <Avatar name={p?.display_name ?? "参加者"} url={p?.avatar_url} size={40} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#3a3428]">
              {p?.display_name ?? "参加者"}
              {p?.member_no != null && (
                <span className="num ml-1 text-[10.5px] font-normal text-[#a09888]">
                  @No.{p.member_no}
                </span>
              )}
            </p>
            <p className="text-[10px] text-[#b8b0a0]">申請 {fmtDate(a.created_at)}</p>
          </div>
          <button
            className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold disabled:opacity-50"
            style={
              a.status === "confirmed"
                ? { background: "#e8862c", color: "#fff" }
                : { border: "1.5px solid #d96a1a", color: "#d96a1a", background: "#fff" }
            }
            disabled={busy === a.id}
            onClick={() => toggle(a)}
          >
            {a.status === "confirmed" ? "🟠 現地入りメンバー（解除）" : "現地入りメンバーにする"}
          </button>
        </div>
        <p className="mt-2 whitespace-pre-wrap rounded-lg bg-[#faf6ee] px-2.5 py-2 text-[12.5px] text-[#4a4438]">
          {a.detail}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
          {(priv?.pref || priv?.city) && (
            <span className="font-bold text-[#5a5448]">
              🏠 {priv?.pref ?? ""}{priv?.city ? ` ${priv.city}` : ""}
            </span>
          )}
          {priv?.phone && (
            <a href={`tel:${priv.phone}`} className="font-bold" style={{ color: "#d96a1a" }}>
              📞 {priv.phone}
            </a>
          )}
          {priv?.email && (
            <a href={`mailto:${priv.email}`} className="font-bold" style={{ color: "#d96a1a" }}>
              ✉️ {priv.email}
            </a>
          )}
          {p?.sns &&
            Object.entries(p.sns).map(([platform, url]) => (
              <a key={platform} href={url} target="_blank" rel="noopener noreferrer" aria-label={platform}>
                <SnsIcon platform={platform.replace(/\d+$/, "")} size={18} />
              </a>
            ))}
          {!priv?.phone && !priv?.email && (
            <span className="text-[#b8b0a0]">連絡先未登録（旧フォームからの申請）</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen pb-24" style={{ background: "#faf6ee" }}>
      <header
        className="sticky top-0 z-30 flex items-center gap-2.5 px-4 py-3 text-white"
        style={{ background: "linear-gradient(120deg,#d96a1a,#a84e0e)" }}
      >
        <Link href="/" className="text-xl text-white no-underline" aria-label="戻る">
          ←
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-megaphone.webp" alt="" className="h-6 w-6 object-contain" />
        <h1 className="text-lg font-bold">事務局</h1>
        <span className="ml-auto text-[10px] opacity-85">管理者専用</span>
      </header>

      <div className="space-y-5 px-4 pt-4">
        <section>
          <h2 className="mb-2 text-sm font-extrabold text-[#5a5448]">
            🏃 現地入り申請 {open.length > 0 && `（未対応 ${open.length}件）`}
          </h2>
          {open.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#e0d6c6] bg-white py-6 text-center text-sm text-[#a09888]">
              新しい申請はありません
            </p>
          ) : (
            <div className="space-y-2.5">{open.map(card)}</div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-extrabold text-[#5a5448]">
            🟠 現地入りメンバー（{confirmed.length}人）
          </h2>
          {confirmed.length === 0 ? (
            <p className="text-sm text-[#a09888]">まだ決定した人はいません</p>
          ) : (
            <div className="space-y-2.5">{confirmed.map(card)}</div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-extrabold text-[#5a5448]">
            ⚑ 通報受信箱 {reports.length > 0 && `（${reports.length}件）`}
          </h2>
          {reports.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#e0d6c6] bg-white py-5 text-center text-sm text-[#a09888]">
              通報はありません
            </p>
          ) : (
            <div className="space-y-2.5">
              {reports.map((r) => {
                const [t, rawId] = r.item_key.split(":");
                return (
                  <div key={r.id} className="rounded-xl border border-[#ede5d8] bg-white p-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={r.profiles?.display_name ?? "参加者"}
                        url={r.profiles?.avatar_url}
                        size={28}
                      />
                      <span className="text-[12.5px] font-bold text-[#3a3428]">
                        {r.profiles?.display_name ?? "参加者"}さんから
                      </span>
                      <span className="ml-auto text-[10px] text-[#b8b0a0]">{fmtDate(r.created_at)}</span>
                    </div>
                    <p className="mt-1.5 text-[13px] font-bold text-[#4a4438]">理由: {r.reason}</p>
                    {r.excerpt && (
                      <p className="mt-1 rounded-lg bg-[#faf6ee] px-2.5 py-1.5 text-[12px] text-[#8a8070]">
                        対象: 「{r.excerpt}」
                      </p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <Link
                        href={`/post/${t}/${rawId}`}
                        className="rounded-full border px-3 py-1.5 text-[11px] font-bold no-underline"
                        style={{ borderColor: "#d96a1a", color: "#d96a1a" }}
                      >
                        投稿を見る
                      </Link>
                      <button
                        className="rounded-full px-3 py-1.5 text-[11px] font-bold text-white"
                        style={{ background: "#d96a1a" }}
                        onClick={async () => {
                          await resolveReport(r.id);
                          reload();
                        }}
                      >
                        対応済みにする
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {session.userId && <AdminSection userId={session.userId} />}
      </div>

      <BottomNav userId={session.userId} active="home" />
    </main>
  );
}

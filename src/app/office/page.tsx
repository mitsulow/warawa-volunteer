"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/useSession";
import {
  createPopup,
  deletePopup,
  fetchAllPopups,
  fetchBodyApplications,
  fetchDonations,
  deleteDonations,
  fetchBugReports,
  fetchBannedUsers,
  setUserBanned,
  fetchShadowedUsers,
  setUserShadow,
  type Profile,
  resolveBugReport,
  type BugReport,
  type Donation,
  fetchReports,
  resolveReport,
  setOfferStatus,
  setPopupActive,
  type BodyApplication,
  type PostReport,
  type Popup,
} from "@/lib/db";
import { uploadImagePair } from "@/lib/images";
import { Avatar } from "@/components/Avatar";
import { AdminSection } from "@/components/AdminSection";
import { SnsIcon, snsHref } from "@/components/SnsIcon";
import { BottomNav } from "@/components/BottomNav";
import { useLongPress } from "@/components/BubbleMenu";
import { createSchedule, fetchSchedules, type Schedule } from "@/lib/schedule";
import { GroupAdminSection } from "@/components/GroupAdminSection";
import { BodyMailSection } from "@/components/BodyMailSection";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 🏛 事務局ページ（管理者のみ）。現地入り申請の確認と決定、管理者の管理 */
/** 寄付一覧の1行（長押しで選択モードに入る） */
function DonationRow({
  d,
  selMode,
  selected,
  onLongPress,
  onToggle,
}: {
  d: Donation;
  selMode: boolean;
  selected: boolean;
  onLongPress: () => void;
  onToggle: () => void;
}) {
  const lp = useLongPress(() => onLongPress());
  return (
    <div
      {...lp.handlers}
      onClick={() => selMode && onToggle()}
      className={`flex select-none items-center gap-2 border-b border-[#f0ece0] px-3 py-2 text-[12.5px] last:border-b-0 ${selMode ? "cursor-pointer" : ""}`}
      style={{ background: selected ? "#fdeedd" : undefined, WebkitTouchCallout: "none" } as React.CSSProperties}
    >
      {selMode && (
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold text-white"
          style={{ borderColor: selected ? "#d96a1a" : "#c8bfae", background: selected ? "#d96a1a" : "#fff" }}
        >
          {selected ? "✓" : ""}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-[#3a3428]">
          {selMode ? (
            <span>{d.display_name ?? "参加者"}</span>
          ) : (
            <Link href={`/u/${d.user_id}`} className="no-underline" style={{ color: "#3a3428" }}>
              {d.display_name ?? "参加者"}
            </Link>
          )}
          {d.email && !selMode && (
            <a href={`mailto:${d.email}`} className="ml-1.5 font-normal" style={{ color: "#d96a1a" }}>
              {d.email}
            </a>
          )}
          {d.email && selMode && <span className="ml-1.5 font-normal text-[#a09888]">{d.email}</span>}
        </p>
        <p className="text-[10.5px] text-[#b8b0a0]">
          {fmtDate(d.created_at)}・{d.listed ? "掲示板に掲載" : "非掲載"}
        </p>
      </div>
      <div className="num shrink-0 text-right">
        <p className="font-extrabold" style={{ color: "#c05e14" }}>{d.units.toLocaleString()}口</p>
        <p className="text-[10.5px] text-[#8a8070]">{d.amount.toLocaleString()}円</p>
      </div>
    </div>
  );
}

export default function OfficePage() {
  const session = useSession();
  const [apps, setApps] = useState<BodyApplication[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  // 📅 日程調整（調整さん風）
  const [scheds, setScheds] = useState<Schedule[]>([]);
  const [sTitle, setSTitle] = useState("現地入りメンバー Zoom面談 日程調整");
  const [sDesc, setSDesc] = useState("事務局とZoomで15分ほど面談させてください。都合の良い日時に○△×を付けてください。");
  const [sSlots, setSSlots] = useState("");
  const [sBusy, setSBusy] = useState(false);
  // 寄付一覧: 長押しで選択モード → 複数選択して削除（テスト分の掃除）
  const [selMode, setSelMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [banned, setBanned] = useState<Profile[]>([]);
  const [shadowed, setShadowed] = useState<Profile[]>([]);
  const [reports, setReports] = useState<PostReport[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  // 用件ごとのタブ + 未対応/対応済みのセグメント（OneSea事務局方式）
  type Tab = "apps" | "donations" | "reports" | "bugs" | "send" | "manage";
  const [tab, setTab] = useState<Tab>("apps");
  const [seg, setSeg] = useState<"open" | "done">("open");
  const [popups, setPopups] = useState<Popup[]>([]);
  const [pBody, setPBody] = useState("");
  const [pLink, setPLink] = useState("");
  const [pPlace, setPPlace] = useState("");
  const [pImage, setPImage] = useState<string | null>(null);
  const [pUploading, setPUploading] = useState(false);
  const [pSending, setPSending] = useState(false);

  const reload = () => {
    fetchBodyApplications().then(setApps);
    fetchDonations().then(setDonations);
    fetchSchedules().then(setScheds);
    fetchBugReports().then(setBugs);
    fetchBannedUsers().then(setBanned);
    fetchShadowedUsers().then(setShadowed);
    fetchReports().then(setReports);
    fetchAllPopups().then(setPopups);
  };

  const sendPopup = async () => {
    if (!session.userId || !pBody.trim() || pSending) return;
    setPSending(true);
    const { error } = await createPopup(
      session.userId,
      pBody.trim(),
      pImage,
      pLink.trim() || null,
      pPlace.trim() || null
    );
    setPSending(false);
    if (error) {
      alert("作成できませんでした: " + error.message);
      return;
    }
    setPBody("");
    setPLink("");
    setPPlace("");
    setPImage(null);
    reload();
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
          <span className="font-bold" style={{ color: priv?.age ? "#5a5448" : "#c0392b" }}>
            🎂 {priv?.age ? `${priv.age}歳` : "年齢未登録"}
          </span>
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
              <a key={platform} href={snsHref(platform, url)} target="_blank" rel="noopener noreferrer" aria-label={platform}>
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
        <Link href="/" className="shrink-0 rounded-full border border-white/60 bg-white/15 px-3 py-1 text-[12.5px] font-bold text-white no-underline" aria-label="戻る">
          戻る
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-megaphone.webp" alt="" className="h-6 w-6 object-contain" />
        <h1 className="text-lg font-bold">事務局</h1>
        <span className="ml-auto text-[10px] opacity-85">管理者専用</span>
      </header>

      <div className="space-y-5 px-4 pt-4">
        {/* タブ（用件ごと・未対応の件数つき） */}
        <div className="hide-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {(
            [
              ["apps", `🏃 現地入り${open.length ? ` (${open.length})` : ""}`],
              ["reports", `⚑ 通報${reports.filter((r) => r.status === "open").length ? ` (${reports.filter((r) => r.status === "open").length})` : ""}`],
              ["bugs", `🐛 バグ${bugs.filter((b) => b.status === "open").length ? ` (${bugs.filter((b) => b.status === "open").length})` : ""}`],
              ["donations", `💰 寄付${donations.length ? ` (${donations.length})` : ""}`],
              ["send", "📢 配信"],
              ["manage", "🛠 管理"],
            ] as Array<[Tab, string]>
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => {
                setTab(v);
                setSeg("open");
              }}
              className="flex-shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-extrabold"
              style={tab === v ? { background: "#d96a1a", borderColor: "#d96a1a", color: "#fff" } : { background: "#fff", borderColor: "#e0d6c6", color: "#6a6255" }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 物資リスト（画像・数量つき・ジャンル別・コピー可） */}
        <Link
          href="/office/goods"
          className="block rounded-xl border py-2.5 text-center text-[13px] font-extrabold no-underline"
          style={{ background: "#fff", borderColor: "#e8c890", color: "#c05e14" }}
        >
          📦 物資をリスト化する（画像・数量つき）
        </Link>

        {/* 未対応 / 対応済み のセグメント（現地入り・通報・バグ） */}
        {(tab === "apps" || tab === "reports" || tab === "bugs") && (
          <div className="flex gap-1.5">
            {(
              [
                ["open", tab === "apps" ? `未対応 ${open.length}` : tab === "reports" ? `未対応 ${reports.filter((r) => r.status === "open").length}` : `未対応 ${bugs.filter((b) => b.status === "open").length}`],
                ["done", tab === "apps" ? `対応済み(現地入りメンバー) ${confirmed.length}` : tab === "reports" ? `対応済み ${reports.filter((r) => r.status === "done").length}` : `対応済み ${bugs.filter((b) => b.status === "done").length}`],
              ] as Array<["open" | "done", string]>
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setSeg(v)}
                className="rounded-full px-3 py-1 text-[11px] font-bold"
                style={seg === v ? { background: "#fdeedd", color: "#c05e14", border: "1px solid #f0d0a8" } : { background: "#fff", color: "#a09888", border: "1px solid #ede5d8" }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {tab === "send" && (
          <Link
            href="/talk/broadcast"
            className="flex items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-extrabold text-white no-underline shadow-md"
            style={{ background: "linear-gradient(120deg,#d96a1a,#a84e0e)" }}
          >
            📢 全員へお知らせを配信する（TalKに届く）
          </Link>
        )}

        {tab === "apps" && <BodyMailSection apps={apps} />}

        {tab === "apps" && (
          <section className="rounded-2xl border border-[#f0d0a8] bg-[#fffaf0] p-3">
            <h2 className="text-sm font-extrabold text-[#c05e14]">📅 日程調整（Zoom面談など・調整さん風）</h2>
            <p className="mt-1 text-[11.5px] text-[#8a7a5a]">候補日時を1行に1つ書いて作成 → 開いたページの「現地入り立候補者へTalKで送る」で一斉に案内できます。○△×の集計表がそのページに出ます。</p>
            {scheds.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {scheds.map((sc) => (
                  <Link key={sc.id} href={`/schedule/${sc.id}`} className="flex items-center gap-2 rounded-xl border border-[#ede5d8] bg-white px-3 py-2 text-[12.5px] no-underline">
                    <span className="min-w-0 flex-1 truncate font-bold text-[#3a3428]">{sc.title}</span>
                    <span className="text-[10.5px] text-[#a09888]">{sc.slots.length}候補{sc.closed ? "・終了" : ""}</span>
                    <span className="text-[11px] font-bold" style={{ color: "#d96a1a" }}>開く →</span>
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-2 rounded-xl border border-[#ede5d8] bg-white p-3">
              <input value={sTitle} onChange={(e) => setSTitle(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-[13px]" style={{ borderColor: "#e0d6c6" }} placeholder="タイトル" />
              <textarea value={sDesc} onChange={(e) => setSDesc(e.target.value)} rows={2} className="mt-2 w-full rounded-lg border px-3 py-2 text-[13px]" style={{ borderColor: "#e0d6c6" }} placeholder="説明（任意）" />
              <textarea
                value={sSlots}
                onChange={(e) => setSSlots(e.target.value)}
                rows={5}
                className="mt-2 w-full rounded-lg border px-3 py-2 text-[13px]"
                style={{ borderColor: "#e0d6c6" }}
                placeholder={"候補日時を1行に1つ\n例:\n8/18(火) 11:00〜\n8/18(火) 16:00〜\n8/18(火) 21:00〜"}
              />
              <button
                disabled={sBusy || !sTitle.trim() || !sSlots.trim()}
                onClick={async () => {
                  if (!session.userId) return;
                  const slots = sSlots.split("\n").map((x) => x.trim()).filter(Boolean);
                  setSBusy(true);
                  const { data, error } = await createSchedule(session.userId, sTitle.trim(), sDesc.trim(), slots);
                  setSBusy(false);
                  if (error || !data) { alert("作成できませんでした"); return; }
                  setSSlots("");
                  fetchSchedules().then(setScheds);
                  window.location.href = `/schedule/${data.id}`;
                }}
                className="mt-2 w-full rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#d96a1a" }}
              >
                📅 日程調整を作成する
              </button>
            </div>
          </section>
        )}

        {tab === "apps" && session.userId && <GroupAdminSection userId={session.userId} scheds={scheds} />}

        {tab === "apps" && seg === "open" && (
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
        )}

        {tab === "manage" && (
        <section>
          <h2 className="mb-2 text-sm font-extrabold text-[#5a5448]">👻 見えないモード中のユーザー（{shadowed.length}人）</h2>
          <p className="mb-2 text-[11.5px] text-[#a09888]">本人には普通に使えているように見えますが、他の参加者からは投稿・コメント・いいね・希望が一切見えず、TalKも始められません。設定はその人のマイページの「👻 見えないモードにする」から。</p>
          {shadowed.length === 0 ? (
            <p className="mb-4 rounded-xl border border-dashed border-[#e0d6c6] bg-white py-4 text-center text-sm text-[#a09888]">いません</p>
          ) : (
            <div className="mb-4 space-y-1.5">
              {shadowed.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-xl border border-[#ede5d8] bg-white px-3 py-2 text-[12.5px]">
                  <Link href={`/u/${p.id}`}><Avatar name={p.display_name} url={p.avatar_url} size={30} /></Link>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#3a3428]">{p.display_name}</p>
                    <p className="text-[10.5px] text-[#b8b0a0]">{p.shadow_at ? fmtDate(p.shadow_at) : ""}{p.shadow_reason ? `・${p.shadow_reason}` : ""}</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`${p.display_name} さんの見えないモードを解除しますか？`)) return;
                      await setUserShadow(p.id, false);
                      reload();
                    }}
                    className="rounded-full border px-2.5 py-1 text-[11px] font-bold text-[#8a7a5a]"
                    style={{ borderColor: "#e8dcc4" }}
                  >
                    解除
                  </button>
                </div>
              ))}
            </div>
          )}
          <h2 className="mb-2 text-sm font-extrabold text-[#5a5448]">🚫 書き込み禁止中のユーザー（{banned.length}人）</h2>
          <p className="mb-2 text-[11.5px] text-[#a09888]">禁止にするには、そのユーザーのマイページ（アイコンをタップ）で「🚫 書き込み禁止にする」を押します。閲覧はできますが、投稿・コメント・TalK・いいね等が全部できなくなります。</p>
          {banned.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#e0d6c6] bg-white py-4 text-center text-sm text-[#a09888]">いません</p>
          ) : (
            <div className="space-y-1.5">
              {banned.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-xl border border-[#ede5d8] bg-white px-3 py-2 text-[12.5px]">
                  <Link href={`/u/${p.id}`}><Avatar name={p.display_name} url={p.avatar_url} size={30} /></Link>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#3a3428]">{p.display_name}</p>
                    <p className="text-[10.5px] text-[#b8b0a0]">{p.banned_at ? fmtDate(p.banned_at) : ""}{p.banned_reason ? `・${p.banned_reason}` : ""}</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`${p.display_name} さんの書き込み禁止を解除しますか？`)) return;
                      await setUserBanned(p.id, false);
                      reload();
                    }}
                    className="rounded-full border px-2.5 py-1 text-[11px] font-bold text-[#8a7a5a]"
                    style={{ borderColor: "#e8dcc4" }}
                  >
                    解除
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
        )}

        {tab === "bugs" && (
        <section>
          <h2 className="mb-2 text-sm font-extrabold text-[#5a5448]">
            🐛 バグ報告 {bugs.filter((b) => b.status === "open").length > 0 && `（未対応 ${bugs.filter((b) => b.status === "open").length}件）`}
          </h2>
          {bugs.filter((b) => b.status === seg).length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#e0d6c6] bg-white py-5 text-center text-sm text-[#a09888]">報告はありません</p>
          ) : (
            <div className="space-y-2">
              {bugs.filter((b) => b.status === seg).map((b) => (
                <div key={b.id} className="rounded-xl border bg-white p-3 text-[12.5px]" style={{ borderColor: b.status === "open" ? "#f0d0a8" : "#ede5d8", opacity: b.status === "open" ? 1 : 0.6 }}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#3a3428]">{b.profiles?.display_name ?? "参加者"}</span>
                    <span className="text-[10.5px] text-[#b8b0a0]">{fmtDate(b.created_at)}{b.page_url ? `・${b.page_url}` : ""}</span>
                    {b.status === "open" ? (
                      <button
                        onClick={async () => {
                          await resolveBugReport(b.id);
                          reload();
                        }}
                        className="ml-auto rounded-lg px-2.5 py-1 text-[11px] font-bold text-white"
                        style={{ background: "#2e7d4f" }}
                      >
                        対応済みにする
                      </button>
                    ) : (
                      <span className="ml-auto text-[11px] font-bold" style={{ color: "#2e7d4f" }}>対応済み</span>
                    )}
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-[#4a4438]">{b.body}</p>
                  {b.ua && <p className="mt-1 truncate text-[10px] text-[#c0b8a8]">{b.ua}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
        )}

        {tab === "donations" && (
        <section>
          <h2 className="mb-2 flex items-center text-sm font-extrabold text-[#5a5448]">
            💰 寄付申込（{donations.length}件・
            <span className="num">{donations.reduce((a, d) => a + d.amount, 0).toLocaleString()}</span>円）
            <button
              className="ml-auto rounded-full border px-2.5 py-1 text-[11px] font-bold"
              style={{ borderColor: "#2e7d4f", color: "#2e7d4f", background: "#fff" }}
              onClick={() => {
                // Excelで開けるCSV（UTF-8 BOM付き）。お礼メールの宛先リスト等に
                const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
                const header = ["申込日時", "お名前", "メールアドレス", "口数", "金額(円)", "掲示板掲載", "ユーザーID"];
                const rows = donations.map((d) => [
                  new Date(d.created_at).toLocaleString("ja-JP"),
                  d.display_name ?? "",
                  d.email ?? "",
                  d.units,
                  d.amount,
                  d.listed ? "掲載" : "非掲載",
                  d.user_id,
                ]);
                const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
                const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `寄付申込一覧_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              📥 CSV(Excel)で保存
            </button>
            {donations.some((d) => d.email) && (
              <button
                className="ml-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold"
                style={{ borderColor: "#d96a1a", color: "#d96a1a", background: "#fff" }}
                onClick={async () => {
                  const emails = Array.from(new Set(donations.map((d) => d.email).filter(Boolean))) as string[];
                  try {
                    await navigator.clipboard.writeText(emails.join(", "));
                    alert(`${emails.length}件のメールアドレスをコピーしました`);
                  } catch {}
                }}
              >
                ✉️ メールアドレスを全部コピー
              </button>
            )}
          </h2>
          {donations.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#e0d6c6] bg-white py-6 text-center text-sm text-[#a09888]">
              まだ寄付の申し込みはありません
            </p>
          ) : (
            <>
              {selMode ? (
                <div className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-bold" style={{ background: "#fdeedd", color: "#c05e14" }}>
                  <span>{selected.size}件を選択中</span>
                  <button
                    className="ml-auto rounded-full px-3 py-1 text-[12px] font-bold text-white disabled:opacity-40"
                    style={{ background: "#c0392b" }}
                    disabled={selected.size === 0}
                    onClick={async () => {
                      if (!window.confirm(`選択した ${selected.size} 件の寄付申込を削除しますか？（元に戻せません）`)) return;
                      await deleteDonations(Array.from(selected));
                      setSelected(new Set());
                      setSelMode(false);
                      reload();
                    }}
                  >
                    削除する
                  </button>
                  <button
                    className="rounded-full border bg-white px-3 py-1 text-[12px] font-bold text-[#8a7a5a]"
                    style={{ borderColor: "#e8dcc4" }}
                    onClick={() => {
                      setSelMode(false);
                      setSelected(new Set());
                    }}
                  >
                    やめる
                  </button>
                </div>
              ) : (
                <p className="mb-1.5 text-[11px] text-[#a09888]">行を長押しすると選択モードになり、複数まとめて削除できます（テスト分の掃除など）</p>
              )}
              <div className="overflow-hidden rounded-xl border border-[#ede5d8] bg-white shadow-sm">
                {donations.map((d) => (
                  <DonationRow
                    key={d.id}
                    d={d}
                    selMode={selMode}
                    selected={selected.has(d.id)}
                    onLongPress={() => {
                      setSelMode(true);
                      setSelected((prev) => new Set(prev).add(d.id));
                    }}
                    onToggle={() => toggleSel(d.id)}
                  />
                ))}
              </div>
            </>
          )}
        </section>
        )}

        {tab === "apps" && seg === "done" && (
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
        )}

        {tab === "reports" && (
        <section>
          <h2 className="mb-2 text-sm font-extrabold text-[#5a5448]">
            ⚑ 通報受信箱 {reports.length > 0 && `（${reports.length}件）`}
          </h2>
          {reports.filter((r) => r.status === seg).length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#e0d6c6] bg-white py-5 text-center text-sm text-[#a09888]">
              通報はありません
            </p>
          ) : (
            <div className="space-y-2.5">
              {reports.filter((r) => r.status === seg).map((r) => {
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
                      {r.status === "open" ? (
                        <button
                          className="rounded-full px-3 py-1.5 text-[11px] font-bold text-white"
                          style={{ background: "#2e7d4f" }}
                          onClick={async () => {
                            await resolveReport(r.id, true);
                            reload();
                          }}
                        >
                          対応済みにする
                        </button>
                      ) : (
                        <button
                          className="rounded-full border px-3 py-1.5 text-[11px] font-bold text-[#8a7a5a]"
                          style={{ borderColor: "#e8dcc4" }}
                          onClick={async () => {
                            await resolveReport(r.id, false);
                            reload();
                          }}
                        >
                          未対応に戻す
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        )}

        {tab === "send" && (
        <section>
          <h2 className="mb-2 text-sm font-extrabold text-[#5a5448]">🚨 全面ポップアップ通知</h2>
          <p className="mb-2 text-[11.5px] text-[#8a8070]">
            重要なお知らせを、アプリを開いた全員の画面前面に全面表示します（例: 9月12日、◯◯で炊き出しをします！）。
            画像・リンク・場所（Googleマップ自動埋め込み）が使えます。
          </p>
          <div className="rounded-xl border border-[#ede5d8] bg-white p-3 shadow-sm">
            <textarea
              className="w-full rounded-xl border border-[#e0d6c6] px-3 py-2 text-[14px]"
              rows={3}
              placeholder="お知らせ本文（例: 9月12日、西園寺で炊き出しをします！）"
              value={pBody}
              onChange={(e) => setPBody(e.target.value)}
            />
            <input
              className="mt-2 w-full rounded-xl border border-[#e0d6c6] px-3 py-2 text-[13px]"
              placeholder="場所（例: 西園寺 熊本県◯◯市… → 地図が自動で埋め込まれます）※任意"
              value={pPlace}
              onChange={(e) => setPPlace(e.target.value)}
            />
            <input
              className="mt-2 w-full rounded-xl border border-[#e0d6c6] px-3 py-2 text-[13px]"
              placeholder="リンク（https://...）※任意"
              value={pLink}
              onChange={(e) => setPLink(e.target.value)}
            />
            <div className="mt-2 flex items-center gap-2">
              <label className="cursor-pointer rounded-xl border border-dashed px-3 py-2 text-[12.5px] font-bold"
                     style={{ borderColor: "#d96a1a", color: "#d96a1a" }}>
                {pUploading ? "⏳ 圧縮中..." : pImage ? "📷 画像を差し替え" : "📷 画像をつける（任意）"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f || !session.userId) return;
                    setPUploading(true);
                    const pair = await uploadImagePair(session.userId, f);
                    setPUploading(false);
                    if (pair) setPImage(pair.full);
                  }}
                />
              </label>
              {pImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pImage} alt="" className="h-12 w-12 rounded-lg object-cover" />
              )}
              <button
                className="ml-auto rounded-xl px-5 py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#d96a1a" }}
                disabled={pSending || pUploading || !pBody.trim()}
                onClick={sendPopup}
              >
                {pSending ? "配信中..." : "全員に表示する"}
              </button>
            </div>
          </div>

          {popups.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {popups.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-xl border border-[#ede5d8] bg-white px-3 py-2 text-[12.5px]">
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${p.active ? "bg-[#e8862c] text-white" : "bg-gray-200 text-gray-500"}`}>
                    {p.active ? "表示中" : "停止中"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[#4a4438]">{p.body}</span>
                  <button
                    className="shrink-0 font-bold underline"
                    style={{ color: "#d96a1a" }}
                    onClick={async () => {
                      await setPopupActive(p.id, !p.active);
                      reload();
                    }}
                  >
                    {p.active ? "停止" : "再開"}
                  </button>
                  <button
                    className="shrink-0 font-bold text-[#c04030] underline"
                    onClick={async () => {
                      if (!window.confirm("このお知らせを削除しますか？")) return;
                      await deletePopup(p.id);
                      reload();
                    }}
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
        )}

        {tab === "manage" && session.userId && <AdminSection userId={session.userId} />}
      </div>

      <BottomNav userId={session.userId} active="home" />
    </main>
  );
}

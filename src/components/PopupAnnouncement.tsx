"use client";

import { useEffect, useState } from "react";
import { fetchActivePopups, type Popup } from "@/lib/db";

/* eslint-disable @next/next/no-img-element */

const SEEN_KEY = "warawa-popup-seen";

function getSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/**
 * 事務局の重要なお知らせを前面・全面に出すポップアップ。
 * 画像・リンク・地図（Googleマップ自動埋め込み・OneSea手帳方式）対応。
 * 「閉じる」を押したお知らせは同じ端末では再表示しない。
 */
export function PopupAnnouncement() {
  const [popup, setPopup] = useState<Popup | null>(null);

  useEffect(() => {
    fetchActivePopups().then((list) => {
      const seen = getSeen();
      const next = list.find((p) => !seen.includes(p.id));
      if (next) setPopup(next);
    });
  }, []);

  if (!popup) return null;

  const close = () => {
    try {
      const seen = getSeen();
      seen.push(popup.id);
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-50)));
    } catch {}
    setPopup(null);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
      <div
        className="max-h-[90vh] w-full max-w-[420px] overflow-y-auto rounded-3xl shadow-2xl"
        style={{ background: "linear-gradient(160deg,#f2a35c,#e0803a)", padding: "6px 6px 0" }}
      >
        <div className="overflow-hidden rounded-2xl bg-white">
          {popup.image_url && (
            <img src={popup.image_url} alt="" className="w-full object-cover" />
          )}
          <div className="p-4">
            <div className="flex items-center gap-2">
              <img src="/waraeru-v2.png" alt="" className="h-8 w-8 object-contain" />
              <span className="text-[13px] font-extrabold" style={{ color: "#c05e14" }}>
                事務局から大切なお知らせ
              </span>
            </div>
            <p className="mt-2.5 whitespace-pre-wrap break-words text-[17px] font-bold leading-relaxed text-[#3a3428]">
              {popup.body}
            </p>

            {/* 地図（場所名からGoogleマップを自動埋め込み） */}
            {popup.place && (
              <div className="mt-3">
                <iframe
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(popup.place)}&hl=ja&z=15&output=embed`}
                  className="h-48 w-full rounded-xl border-0"
                  loading="lazy"
                  title="地図"
                />
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(popup.place)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-block text-[13px] font-bold underline"
                  style={{ color: "#d96a1a" }}
                >
                  📍 {popup.place} を地図アプリで開く
                </a>
              </div>
            )}

            {popup.link_url && (
              <a
                href={popup.link_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block rounded-xl py-3 text-center text-[15px] font-extrabold text-white no-underline"
                style={{ background: "#d96a1a" }}
              >
                🔗 くわしく見る
              </a>
            )}

            <button
              className="mt-3 mb-1 w-full rounded-xl border-2 py-2.5 text-[14px] font-bold"
              style={{ borderColor: "#d96a1a", color: "#d96a1a" }}
              onClick={close}
            >
              閉じる
            </button>
          </div>
        </div>
        <div className="flex h-[24px] items-center justify-end pr-2.5">
          <img src="/warawa-logo.png" alt="わらわ〜" className="h-[15px] w-auto object-contain" />
        </div>
      </div>
    </div>
  );
}

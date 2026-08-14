"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * PWAインストール自動促進。
 * - すでにアプリとして起動中(standalone)なら何も出さない
 * - Android/PC Chrome: beforeinstallprompt を捕まえて、バナー1タップでインストール
 *   （ホーム画面/デスクトップにアイコン追加・アドレスバーなしの全画面になる）
 * - iPhone Safari: 自動インストール不可のため手順ガイドを表示
 * - 「あとで」を押したら7日間は出さない
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosGuide, setIosGuide] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Service Worker登録（インストール要件 + 簡易オフライン）
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // すでにアプリとして起動している → 何もしない
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // ×を押しても3時間たったらまた出す
    try {
      sessionStorage.removeItem("warawa-install-snooze"); // 旧スヌーズの掃除
      const snoozed = localStorage.getItem("warawa-install-snooze");
      if (snoozed && Date.now() - Number(snoozed) < 3 * 3600000) return;
    } catch {}

    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    setIsIos(ios);

    if (ios) {
      // iOSは beforeinstallprompt が無い → 少し待ってからバナーを出す
      const t = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(t);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => setShow(false);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setShow(false);
      setDeferred(null);
    } else if (isIos) {
      setIosGuide(true);
    }
  };

  const snooze = () => {
    try {
      localStorage.setItem("warawa-install-snooze", String(Date.now()));
    } catch {}
    setShow(false);
    setIosGuide(false);
  };

  if (!show) return null;

  return (
    <>
      {/* 前面の中央ダイアログ（目立つように） */}
      <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/55 px-5 pt-[18vh]">
        <div
          className="relative w-full max-w-[340px] rounded-3xl p-5 text-center shadow-2xl"
          style={{ background: "#fffdf8" }}
        >
          <button
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#f0ece2] text-[15px] font-bold text-[#8a8070]"
            aria-label="あとで"
            onClick={snooze}
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-192.png"
            alt=""
            className="mx-auto h-16 w-16 rounded-2xl object-cover shadow"
          />
          <h3 className="mt-3 text-[17px] font-extrabold text-[#3a3428]">
            ホーム画面に追加できます
          </h3>
          <button
            className="mt-4 w-full rounded-2xl py-3.5 text-[15px] font-extrabold text-white shadow-md"
            style={{ background: "linear-gradient(120deg,#d96a1a,#a84e0e)" }}
            onClick={install}
          >
            ホーム画面に追加
          </button>
        </div>
      </div>

      {/* iOS用ガイド */}
      {iosGuide && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-5"
          onClick={() => setIosGuide(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-3xl">📱</div>
            <h3 className="mt-2 text-[16px] font-bold text-[#3a3428]">
              ホーム画面に追加（アプリ化）
            </h3>
            <ol className="mx-auto mt-3 max-w-[260px] space-y-2 text-left text-[13.5px] leading-relaxed text-[#5a5448]">
              <li>
                1. 画面下の <b>共有ボタン</b>{" "}
                <span className="inline-block rounded border border-[#c0b8a8] px-1 text-[12px]">⬆︎</span>{" "}
                をタップ
              </li>
              <li>
                2. <b>「ホーム画面に追加」</b>を選ぶ
              </li>
              <li>3. 右上の「追加」をタップ</li>
            </ol>
            <p className="mt-3 text-[11.5px] text-[#8a8070]">
              以降はホーム画面のアイコンから、アドレスバーなしの全画面で開けます
            </p>
            <button
              className="mt-4 w-full rounded-xl py-3 text-[14px] font-bold text-white"
              style={{ background: "#d96a1a" }}
              onClick={snooze}
            >
              わかった
            </button>
          </div>
        </div>
      )}
    </>
  );
}

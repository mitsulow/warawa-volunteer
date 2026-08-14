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
      {/* 下部バナー（下タブの上に出す） */}
      <div className="fixed bottom-16 left-1/2 z-50 w-[calc(100%-24px)] max-w-[496px] -translate-x-1/2">
        <div
          className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 shadow-xl"
          style={{ background: "linear-gradient(120deg,#d96a1a,#a84e0e)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/waraeru-archangel.png"
            alt=""
            className="h-9 w-9 flex-shrink-0 object-contain"
          />
          <p className="min-w-0 flex-1 text-[13px] font-extrabold leading-tight text-white">
            ホーム画面に追加できます
          </p>
          <button
            className="flex-shrink-0 rounded-full bg-white px-3 py-1.5 text-[12px] font-extrabold"
            style={{ color: "#d96a1a" }}
            onClick={install}
          >
            ホーム画面に追加
          </button>
          <button
            className="flex-shrink-0 px-1 text-[18px] text-white/70"
            aria-label="あとで"
            onClick={snooze}
          >
            ×
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

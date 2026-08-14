"use client";

import { useEffect, useState } from "react";

/**
 * アプリ内ブラウザ（LINE・Instagram等のWebView）検知。
 * Googleログインがアプリ内ブラウザでは動かない（Googleが拒否する）ため、
 * デフォルトのブラウザ（Chrome / Safari）へ誘導する。
 * LINEは ?openExternalBrowser=1 を付けて開き直すと外部ブラウザに自動移行する公式仕様がある。
 */
export function InAppBrowserGuard() {
  const [mode, setMode] = useState<"none" | "line" | "inapp">("none");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isLine = / Line\/|Line\//i.test(ua);
    const isInApp =
      /FBAN|FBAV|Instagram|Threads|TikTok|Twitter|MicroMessenger/i.test(ua);

    if (isLine) {
      setMode("line");
      // 自動でデフォルトブラウザへ（LINE公式のパラメータ）。1回だけ試す
      try {
        const url = new URL(window.location.href);
        if (!url.searchParams.has("openExternalBrowser")) {
          url.searchParams.set("openExternalBrowser", "1");
          window.location.replace(url.toString());
        }
      } catch {}
    } else if (isInApp) {
      setMode("inapp");
    }
  }, []);

  if (mode === "none") return null;

  const copyUrl = async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("openExternalBrowser");
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl">
        <div className="text-3xl">🌐</div>
        <h2 className="mt-2 text-[16px] font-bold text-[#3a3428]">
          {mode === "line"
            ? "LINEアプリ内で開いているようです"
            : "アプリ内ブラウザで開いているようです"}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[#5a5448]">
          このままではGoogleログインができません。
          <br />
          <b>デフォルトのブラウザ</b>（Android: Chrome / iPhone: Safari）で開き直してください。
        </p>
        {mode === "line" ? (
          <p className="mt-2 text-[12px] text-[#8a8070]">
            自動で開き直しています…。切り替わらない場合は、右下の「…」メニューから
            <b>「他のアプリで開く」→「デフォルトのブラウザで開く」</b>を選んでください。
          </p>
        ) : (
          <p className="mt-2 text-[12px] text-[#8a8070]">
            画面右上の「…」メニューから<b>「ブラウザで開く」</b>を選ぶか、
            下のボタンでURLをコピーしてブラウザに貼り付けてください。
          </p>
        )}
        <button
          className="mt-4 w-full rounded-xl py-3 text-[14px] font-bold text-white"
          style={{ background: "#c94d3a" }}
          onClick={copyUrl}
        >
          {copied ? "✅ コピーしました" : "URLをコピーする"}
        </button>
      </div>
    </div>
  );
}

import Link from "next/link";
import { TermsBody } from "@/components/TermsBody";
import { TERMS_VERSION } from "@/lib/terms";

export const metadata = { title: "ご利用にあたって｜わらわ〜ボランティア" };

/** 了承事項の全文ページ（いつでも読み返せる） */
export default function TermsPage() {
  return (
    <main className="min-h-screen pb-16" style={{ background: "#faf6ee" }}>
      <header className="pt-safe-head sticky top-0 z-30 flex items-center gap-3 border-b border-[#ede5d8] bg-white/95 px-4 py-3 backdrop-blur-sm">
        <Link href="/" className="text-xl no-underline" style={{ color: "#d96a1a" }} aria-label="戻る">
          ←
        </Link>
        <span className="text-[14px] font-bold text-[#1c1e21]">ご利用にあたって</span>
        <span className="ml-auto text-[10px] text-[#a09888]">改訂 {TERMS_VERSION}</span>
      </header>
      <div className="mx-4 mt-4 rounded-2xl border border-[#ede5d8] bg-white p-4 shadow-sm">
        <TermsBody />
      </div>
    </main>
  );
}

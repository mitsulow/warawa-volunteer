import { TERMS_CLOSING, TERMS_SECTIONS, TERMS_SIGNATURE } from "@/lib/terms";

/** 了承事項の本文（規約ページとダイアログのスクロール枠で共用） */
export function TermsBody({ compact = false }: { compact?: boolean }) {
  const p = compact ? "text-[12px] leading-relaxed" : "text-[14px] leading-relaxed";
  const h = compact ? "text-[13px]" : "text-[15.5px]";
  return (
    <div className={`space-y-4 text-[#3a3428] ${p}`}>
      {TERMS_SECTIONS.map((sec) => (
        <section key={sec.title}>
          <h3 className={`mb-1 font-extrabold ${h}`} style={{ color: "#c05e14" }}>
            ⚫ {sec.title}
          </h3>
          <div className="space-y-1">
            {sec.body.map((line, i) =>
              line.startsWith("* ") ? (
                <p key={i} className="pl-4">
                  ・{line.slice(2)}
                </p>
              ) : (
                <p key={i}>{line}</p>
              )
            )}
          </div>
        </section>
      ))}
      <div className="pt-1">
        {TERMS_CLOSING.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
        <p className="mt-2 text-right font-bold">{TERMS_SIGNATURE}</p>
      </div>
    </div>
  );
}

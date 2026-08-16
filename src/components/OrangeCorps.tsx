"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchOrangeCorps, type Profile } from "@/lib/db";
import { VerifiedBadge } from "@/components/VerifiedBadge";

/**
 * 🟠 オレンジ軍団（楽市楽座「おすすめの座主」を移植）。
 * 現地に行くことが決まった人のカードを横に並べる。タップでマイページへ。
 */
export function OrangeCorps() {
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    fetchOrangeCorps().then(setProfiles);
  }, []);

  if (profiles.length === 0) return null;

  return (
    <div>
      <p className="mb-1.5 px-1 text-xs font-medium text-[#8a8070]">現地入りメンバー</p>
      <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {profiles.map((p) => (
          <Link
            key={p.id}
            href={`/u/${p.id}`}
            className="block w-32 flex-shrink-0 overflow-hidden rounded-xl border p-2.5 text-center no-underline"
            style={{
              borderColor: "#f0c090",
              background: "linear-gradient(180deg,#fff7ec 0%,#fdeed8 100%)",
            }}
          >
            <div className="flex justify-center">
              {p.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.avatar_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-[#e8862c]"
                />
              ) : (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full ring-2 ring-[#e8862c]"
                  style={{ background: "linear-gradient(140deg,#fad8a8,#f0b060)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/icon-leaf.webp" alt="" style={{ width: 16, height: 16 }} />
                </div>
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-0.5 truncate text-xs font-bold text-[#3a3428]">
              <span className="truncate">{p.display_name || "参加者"}</span>
              <VerifiedBadge size={13} />
            </div>
            <div className="num mt-0.5 truncate text-[10px] text-[#c07020]">
              @わらわ〜ボランティアNo.{p.member_no ?? "?"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

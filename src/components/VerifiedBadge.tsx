/**
 * 認証マーク（青のレ点）。OneSeaのWarawaBadgeと同じ文法:
 * 名前の直後に置く波形縁どり円+レ点。わらわ〜ボランティアでは参加者全員に付く。
 */
export function VerifiedBadge({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-1.5 -1.5 23 23"
      role="img"
      aria-label="認証済みボランティア"
      className="inline-block flex-shrink-0 align-[-2px]"
    >
      <title>認証済みボランティア</title>
      <path
        d="M10 0l2.4 1.8 3-.4 1.2 2.8 2.8 1.2-.4 3L20 10l-1.8 2.4.4 3-2.8 1.2-1.2 2.8-3-.4L10 20l-2.4-1.8-3 .4-1.2-2.8-2.8-1.2.4-3L0 10l1.8-2.4-.4-3 2.8-1.2L5.4.6l3 .4z"
        fill="#2CB7DE"
      />
      <path
        d="M5.6 10.3l2.9 2.9 5.9-6"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

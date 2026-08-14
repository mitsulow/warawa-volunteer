"use client";

/** アバター画像が無い間は名前の頭文字の丸で代用 */
export function Avatar({
  name,
  url,
  size = 40,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  const initial = (name || "？").trim().charAt(0) || "？";
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-[#3a7d44] text-white flex items-center justify-center font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {initial}
    </div>
  );
}

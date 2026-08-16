"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * アイコン用の丸トリミング。写真を選んだ後に位置（ドラッグ）と大きさ（スライダー/ピンチ）を決めて、
 * 512pxの正方形に切り出して返す。iPhone/Androidどちらもポインターイベントで動く。
 */
export function AvatarCropper({
  file,
  onDone,
  onCancel,
}: {
  file: File;
  onDone: (cropped: File) => void;
  onCancel: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1); // 1 = 枠にぴったり収まる最小倍率
  const [pos, setPos] = useState({ x: 0, y: 0 }); // 画像中心の枠中心からのずれ(px・表示座標)
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const BOX = 260;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    const im = new Image();
    im.onload = () => setImg(im);
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!src) return null;

  // 表示上の画像サイズ（最小倍率で枠を覆う）
  const base = img ? Math.max(BOX / img.width, BOX / img.height) : 1;
  const dw = img ? img.width * base * zoom : BOX;
  const dh = img ? img.height * base * zoom : BOX;
  const clampPos = (p: { x: number; y: number }) => {
    const mx = Math.max(0, (dw - BOX) / 2);
    const my = Math.max(0, (dh - BOX) / 2);
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom };
      drag.current = null;
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = Array.from(pointers.current.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const z = Math.min(4, Math.max(1, (pinch.current.z * d) / pinch.current.d));
      setZoom(z);
      setPos((p) => clampPos(p));
      return;
    }
    if (drag.current) {
      setPos(clampPos({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) }));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) drag.current = null;
  };

  const finish = async () => {
    if (!img || busy) return;
    setBusy(true);
    const OUT = 512;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d")!;
    // 表示座標 → 元画像座標
    const scale = base * zoom; // 表示px / 元px
    const sw = BOX / scale;
    const sh = BOX / scale;
    const cx = img.width / 2 - pos.x / scale;
    const cy = img.height / 2 - pos.y / scale;
    ctx.drawImage(img, cx - sw / 2, cy - sh / 2, sw, sh, 0, 0, OUT, OUT);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    setBusy(false);
    if (!blob) return;
    onDone(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
  };

  return createPortal(
    <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
        <p className="text-center text-[14px] font-extrabold text-[#3a3428]">アイコンの位置と大きさを決める</p>
        <p className="mt-0.5 text-center text-[11px] text-[#8a8070]">ドラッグで移動・スライダー（または2本指）で拡大縮小</p>
        <div className="mt-3 flex justify-center">
          <div
            className="relative touch-none select-none overflow-hidden rounded-full border-4 border-[#f2ede4] bg-[#eee]"
            style={{ width: BOX, height: BOX }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{
                width: dw,
                height: dh,
                left: BOX / 2 - dw / 2 + pos.x,
                top: BOX / 2 - dh / 2 + pos.y,
              }}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 px-2">
          <span className="text-[12px] text-[#8a8070]">小</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => {
              setZoom(Number(e.target.value));
              setPos((p) => clampPos(p));
            }}
            className="flex-1 accent-[#d96a1a]"
          />
          <span className="text-[12px] text-[#8a8070]">大</span>
        </div>
        <div className="mt-3 flex gap-2">
          <button className="flex-1 rounded-xl border py-2.5 text-[13px] font-bold text-[#8a8070]" style={{ borderColor: "#e8dcc4" }} onClick={onCancel}>
            やめる
          </button>
          <button
            className="flex-1 rounded-xl py-2.5 text-[13px] font-extrabold text-white disabled:opacity-50"
            style={{ background: "#d96a1a" }}
            disabled={busy || !img}
            onClick={finish}
          >
            {busy ? "切り出し中…" : "この位置で決定"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

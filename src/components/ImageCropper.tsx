"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * 写真の切り抜き（拡大縮小 + 位置）。アイコン（丸・1:1）にも投稿写真（四角・比率選択）にも使う。
 * ドラッグで移動、スライダー or 2本指で拡大縮小。iPhone/Androidともポインターイベントで動く。
 */
export type CropAspect = { label: string; value: number };
export const POST_ASPECTS: CropAspect[] = [
  { label: "4:3", value: 4 / 3 },
  { label: "1:1", value: 1 },
  { label: "3:4", value: 3 / 4 },
  { label: "16:9", value: 16 / 9 },
];

export function ImageCropper({
  file,
  shape = "rect",
  aspects,
  initialAspect,
  title = "写真の位置と大きさを決める",
  allowSkip = false,
  onDone,
  onCancel,
  progress,
}: {
  file: File;
  shape?: "circle" | "rect";
  aspects?: CropAspect[]; // 省略時は1:1固定
  initialAspect?: number;
  title?: string;
  allowSkip?: boolean; // 「そのまま使う」を出す（投稿写真用）
  onDone: (cropped: File | null) => void; // null = そのまま使う
  onCancel: () => void;
  progress?: ReactNode; // 「2/4枚目」など
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [aspect, setAspect] = useState<number>(initialAspect ?? aspects?.[0]?.value ?? 1);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());

  const BW = 300;
  const BH = Math.round(BW / aspect);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    const im = new Image();
    im.onload = () => setImg(im);
    im.src = url;
    setZoom(1);
    setPos({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    setPos({ x: 0, y: 0 });
  }, [aspect]);

  if (!src) return null;

  const base = img ? Math.max(BW / img.width, BH / img.height) : 1;
  const dw = img ? img.width * base * zoom : BW;
  const dh = img ? img.height * base * zoom : BH;
  const clampPos = (p: { x: number; y: number }) => {
    const mx = Math.max(0, (dw - BW) / 2);
    const my = Math.max(0, (dh - BH) / 2);
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
      setZoom(Math.min(4, Math.max(1, (pinch.current.z * d) / pinch.current.d)));
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
    const scale = base * zoom;
    const sw = BW / scale;
    const sh = BH / scale;
    const cx = img.width / 2 - pos.x / scale;
    const cy = img.height / 2 - pos.y / scale;
    // 出力: 長辺 1600px まで（アイコンは512）
    const outLong = shape === "circle" ? 512 : Math.min(1600, Math.round(Math.max(sw, sh)));
    const ow = aspect >= 1 ? outLong : Math.round(outLong * aspect);
    const oh = aspect >= 1 ? Math.round(outLong / aspect) : outLong;
    const canvas = document.createElement("canvas");
    canvas.width = ow;
    canvas.height = oh;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, cx - sw / 2, cy - sh / 2, sw, sh, 0, 0, ow, oh);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    setBusy(false);
    if (!blob) return;
    onDone(new File([blob], (file.name.replace(/\.[^.]+$/, "") || "photo") + ".jpg", { type: "image/jpeg" }));
  };

  return createPortal(
    <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
        <p className="text-center text-[14px] font-extrabold text-[#3a3428]">
          {title}
          {progress && <span className="ml-1.5 text-[11px] font-bold text-[#a09888]">{progress}</span>}
        </p>
        <p className="mt-0.5 text-center text-[11px] text-[#8a8070]">ドラッグで移動・スライダー（または2本指）で拡大縮小</p>
        {aspects && aspects.length > 1 && (
          <div className="mt-2 flex justify-center gap-1.5">
            {aspects.map((a) => (
              <button
                key={a.label}
                onClick={() => setAspect(a.value)}
                className="rounded-full border px-2.5 py-[3px] text-[11.5px] font-bold"
                style={
                  aspect === a.value
                    ? { background: "#d96a1a", color: "#fff", borderColor: "#d96a1a" }
                    : { background: "#fff", color: "#8a7a5a", borderColor: "#e8dcc4" }
                }
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 flex justify-center">
          <div
            className={`relative touch-none select-none overflow-hidden border-4 border-[#f2ede4] bg-[#eee] ${shape === "circle" ? "rounded-full" : "rounded-lg"}`}
            style={{ width: BW, height: BH }}
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
              style={{ width: dw, height: dh, left: BW / 2 - dw / 2 + pos.x, top: BH / 2 - dh / 2 + pos.y }}
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
          <button className="rounded-xl border px-3 py-2.5 text-[13px] font-bold text-[#8a8070]" style={{ borderColor: "#e8dcc4" }} onClick={onCancel}>
            やめる
          </button>
          {allowSkip && (
            <button className="flex-1 rounded-xl border py-2.5 text-[13px] font-bold" style={{ borderColor: "#d96a1a", color: "#d96a1a" }} onClick={() => onDone(null)}>
              そのまま使う
            </button>
          )}
          <button
            className="flex-1 rounded-xl py-2.5 text-[13px] font-extrabold text-white disabled:opacity-50"
            style={{ background: "#d96a1a" }}
            disabled={busy || !img}
            onClick={finish}
          >
            {busy ? "切り出し中…" : "この範囲で決定"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * 複数写真を1枚ずつ切り抜くキュー。start(files) → 順にクロッパー表示 → 全部終わったら onFinish(files)。
 * 使い方: const crop = useCropQueue((files) => upload(files)); <input onChange={e => crop.start(files)} />{crop.element}
 */
export function useCropQueue(onFinish: (files: File[]) => void) {
  const [queue, setQueue] = useState<File[]>([]);
  const [idx, setIdx] = useState(0);
  const results = useRef<File[]>([]);

  const start = (files: File[]) => {
    if (!files.length) return;
    results.current = [];
    setQueue(files);
    setIdx(0);
  };
  const stepDone = (f: File | null) => {
    results.current.push(f ?? queue[idx]);
    if (idx + 1 < queue.length) setIdx(idx + 1);
    else {
      const out = results.current;
      setQueue([]);
      setIdx(0);
      onFinish(out);
    }
  };
  const cancel = () => {
    setQueue([]);
    setIdx(0);
  };
  const element =
    queue.length > 0 ? (
      <ImageCropper
        key={`${idx}-${queue[idx].name}-${queue[idx].size}`}
        file={queue[idx]}
        shape="rect"
        aspects={POST_ASPECTS}
        allowSkip
        title="写真を切り抜く"
        progress={queue.length > 1 ? `${idx + 1}/${queue.length}枚目` : undefined}
        onDone={stepDone}
        onCancel={cancel}
      />
    ) : null;
  return { start, element, active: queue.length > 0 };
}

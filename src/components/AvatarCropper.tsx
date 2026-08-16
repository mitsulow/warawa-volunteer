"use client";

import { ImageCropper } from "@/components/ImageCropper";

/** アイコン用の丸トリミング（ImageCropper の circle/1:1 版） */
export function AvatarCropper({
  file,
  onDone,
  onCancel,
}: {
  file: File;
  onDone: (cropped: File) => void;
  onCancel: () => void;
}) {
  return (
    <ImageCropper
      file={file}
      shape="circle"
      title="アイコンの位置と大きさを決める"
      onDone={(f) => f && onDone(f)}
      onCancel={onCancel}
    />
  );
}

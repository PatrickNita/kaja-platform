"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function MerchImageUploader({ brand, itemId }: { brand: "kaja" | "hexenwerk"; itemId: number }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Use a JPEG, PNG, or WebP image."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Images must be 10 MB or smaller."); return; }
    setProgress(0);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      await upload(`merch/${brand}/${itemId}-${crypto.randomUUID()}-${safeName}`, file, {
        access: "private", handleUploadUrl: "/api/merch-images", clientPayload: JSON.stringify({ itemId, brand }), onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });
      router.refresh();
      if (input.current) input.current.value = "";
    } catch { setError("Image upload failed. Please try again."); } finally { setProgress(null); }
  }

  return <div className="image-uploader"><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} disabled={progress !== null} /><p>JPEG, PNG, or WebP · max 10 MB</p>{progress !== null && <p>Uploading {progress}%</p>}{error && <p className="upload-error">{error}</p>}</div>;
}

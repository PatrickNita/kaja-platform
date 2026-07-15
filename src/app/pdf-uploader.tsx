"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function PdfUploader() {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) { setError("Only PDF files are allowed."); return; }
    if (file.size > 25 * 1024 * 1024) { setError("PDFs must be 25 MB or smaller."); return; }
    setProgress(0);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      await upload(`attachments/${crypto.randomUUID()}-${safeName}`, file, { access: "private", handleUploadUrl: "/api/uploads", clientPayload: JSON.stringify({ filename: file.name }), onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)) });
      router.refresh();
      if (input.current) input.current.value = "";
    } catch {
      setError("Upload failed. Please try again.");
    } finally { setProgress(null); }
  }

  return <div className="pdf-uploader"><input ref={input} type="file" accept="application/pdf,.pdf" onChange={onChange} disabled={progress !== null} /><p>PDF only · max 25 MB</p>{progress !== null && <p>Uploading {progress}%</p>}{error && <p className="upload-error">{error}</p>}</div>;
}

"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { attachmentContentType, maxAttachmentSize } from "../lib/attachment-files";
import { BrandPicker, type Brand } from "./brand-picker";

export function PdfUploader({ initialBrand, folderId }: { initialBrand?: Brand; folderId?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [brand, setBrand] = useState<Brand | "">(initialBrand ?? "");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    const selectedBrand = brand;
    if (!selectedBrand) { setError("Alege brandul fișierului."); return; }
    if (attachmentContentType(file.name) !== file.type) { setError("Sunt permise doar PDF și PNG."); return; }
    if (file.size > maxAttachmentSize) { setError("Fișierele trebuie să aibă maximum 25 MB."); return; }
    setProgress(0);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      await upload(`attachments/${selectedBrand}/${crypto.randomUUID()}-${safeName}`, file, { access: "private", handleUploadUrl: "/api/uploads", clientPayload: JSON.stringify({ filename: file.name, brand: selectedBrand, folderId }), onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)) });
      router.refresh();
      if (input.current) input.current.value = "";
    } catch {
      setError("Încărcarea a eșuat. Încearcă din nou.");
    } finally { setProgress(null); }
  }

  return <div className="pdf-uploader"><BrandPicker value={brand} onChange={setBrand} disabled={progress !== null || Boolean(folderId)} legend="Brandul fișierului" /><input ref={input} type="file" accept="application/pdf,image/png,.pdf,.png" onChange={onChange} disabled={!brand || progress !== null} /><p>PDF sau PNG · maximum 25 MB</p>{progress !== null && <p>Se încarcă {progress}%</p>}{error && <p className="upload-error">{error}</p>}</div>;
}

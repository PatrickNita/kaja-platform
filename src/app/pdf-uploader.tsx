"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BrandPicker, type Brand } from "./brand-picker";

export function PdfUploader({ initialBrand }: { initialBrand?: Brand }) {
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
    if (!selectedBrand) { setError("Alege brandul PDF-ului."); return; }
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) { setError("Sunt permise doar fișierele PDF."); return; }
    if (file.size > 25 * 1024 * 1024) { setError("PDF-urile trebuie să aibă maximum 25 MB."); return; }
    setProgress(0);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      await upload(`attachments/${selectedBrand}/${crypto.randomUUID()}-${safeName}`, file, { access: "private", handleUploadUrl: "/api/uploads", clientPayload: JSON.stringify({ filename: file.name, brand: selectedBrand }), onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)) });
      router.refresh();
      if (input.current) input.current.value = "";
    } catch {
      setError("Încărcarea a eșuat. Încearcă din nou.");
    } finally { setProgress(null); }
  }

  return <div className="pdf-uploader"><BrandPicker value={brand} onChange={setBrand} disabled={progress !== null} legend="Brandul PDF-ului" /><input ref={input} type="file" accept="application/pdf,.pdf" onChange={onChange} disabled={!brand || progress !== null} /><p>Doar PDF · maximum 25 MB</p>{progress !== null && <p>Se încarcă {progress}%</p>}{error && <p className="upload-error">{error}</p>}</div>;
}

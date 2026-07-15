"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

export function MerchComposer({ brand }: { brand: "kaja" | "hexenwerk" | "virginia" }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function chooseImage(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    setError(""); setSuccess("");
    if (!selected) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) { setFile(null); setError("Folosește o imagine JPEG, PNG sau WebP."); return; }
    if (selected.size > 10 * 1024 * 1024) { setFile(null); setError("Imaginile trebuie să aibă maximum 10 MB."); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected); setPreview(URL.createObjectURL(selected));
  }

  async function createMerch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) { setError("O imagine este obligatorie pentru fiecare produs merch."); return; }
    setError(""); setSuccess(""); setProgress(0);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      await upload(`merch/${brand}/new-${crypto.randomUUID()}-${safeName}`, file, {
        access: "private",
        handleUploadUrl: "/api/merch-images",
        clientPayload: JSON.stringify({ brand, title: title.trim(), body: body.trim() }),
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });
      setTitle(""); setBody(""); setFile(null); setPreview(""); setSuccess("Produsul merch a fost creat.");
      if (input.current) input.current.value = "";
      window.setTimeout(() => router.refresh(), 900);
    } catch { setError("Încărcarea imaginii a eșuat. Produsul merch nu a fost creat."); } finally { setProgress(null); }
  }

  return <form className="form merch-composer" onSubmit={createMerch}><input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} placeholder="Titlu produs merch" disabled={progress !== null} /><textarea value={body} onChange={(event) => setBody(event.target.value)} required maxLength={4000} placeholder="Descrie produsul merch." disabled={progress !== null} /><div className="image-uploader"><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} required disabled={progress !== null} /><p>Obligatoriu: JPEG, PNG sau WebP · maximum 10 MB</p>{preview && <img className="merch-preview merch-preview--draft" src={preview} alt="Previzualizare produs merch nou" />}{progress !== null && <p>Se încarcă {progress}%</p>}{error && <p className="upload-error">{error}</p>}{success && <p className="upload-success">{success}</p>}</div><button className="button" disabled={!file || progress !== null}>Creează produsul merch</button></form>;
}

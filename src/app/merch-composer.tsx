"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { AutoResizeTextarea } from "./comment-textarea";

export function MerchComposer({ brand }: { brand: "kaja" | "hexenwerk" | "virginia" }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => () => { previews.forEach((preview) => URL.revokeObjectURL(preview)); }, [previews]);

  function chooseImage(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    setError(""); setSuccess("");
    if (!selected.length) return;
    if (selected.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) { setFiles([]); setError("Folosește doar imagini JPEG, PNG sau WebP."); return; }
    if (selected.some((file) => file.size > 10 * 1024 * 1024)) { setFiles([]); setError("Fiecare imagine trebuie să aibă maximum 10 MB."); return; }
    previews.forEach((preview) => URL.revokeObjectURL(preview));
    setFiles(selected); setPreviews(selected.map((file) => URL.createObjectURL(file)));
  }

  async function createMerch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!files.length) { setError("Cel puțin o imagine este obligatorie pentru fiecare produs Merch."); return; }
    setError(""); setSuccess(""); setProgress("Se creează produsul…");
    try {
      const first = files[0];
      const safeName = first.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const firstBlob = await upload(`item-images/${brand}/new-${crypto.randomUUID()}-${safeName}`, first, {
        access: "private",
        handleUploadUrl: "/api/item-images",
        clientPayload: JSON.stringify({ mode: "create-merch", brand, title: title.trim(), body: body.trim() }),
        onUploadProgress: ({ percentage }) => setProgress(`Imaginea 1/${files.length} · ${Math.round(percentage)}%`),
      });
      let itemId: number | null = null;
      for (let attempt = 0; attempt < 6 && !itemId; attempt += 1) {
        const response = await fetch(`/api/item-images/resolve?brand=${brand}&url=${encodeURIComponent(firstBlob.url)}`, { cache: "no-store" });
        if (response.ok) itemId = (await response.json() as { itemId: number }).itemId;
        else await new Promise((resolve) => window.setTimeout(resolve, 300 + attempt * 200));
      }
      if (!itemId) throw new Error("Produsul a fost creat, dar galeria nu a putut fi finalizată.");
      for (let index = 1; index < files.length; index += 1) {
        const file = files[index];
        const nextName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        await upload(`item-images/${brand}/${itemId}-${crypto.randomUUID()}-${nextName}`, file, { access: "private", handleUploadUrl: "/api/item-images", clientPayload: JSON.stringify({ mode: "append", brand, itemId, section: "merch" }), onUploadProgress: ({ percentage }) => setProgress(`Imaginea ${index + 1}/${files.length} · ${Math.round(percentage)}%`) });
      }
      setTitle(""); setBody(""); setFiles([]); setPreviews([]); setSuccess("Produsul Merch a fost creat.");
      if (input.current) input.current.value = "";
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Încărcarea imaginilor a eșuat."); } finally { setProgress(null); }
  }

  return <form className="form merch-composer" onSubmit={createMerch}><AutoResizeTextarea className="field-title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} placeholder="Titlu produs merch" disabled={progress !== null} /><AutoResizeTextarea value={body} onChange={(event) => setBody(event.target.value)} required maxLength={4000} placeholder="Descrie produsul merch." disabled={progress !== null} /><div className="image-uploader"><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={chooseImage} required disabled={progress !== null} /><p>Obligatoriu: JPEG, PNG sau WebP · maximum 10 MB per imagine</p>{previews.length > 0 && <div className="draft-gallery">{previews.map((preview, index) => <img key={preview} src={preview} alt={`Previzualizare ${index + 1}`} />)}</div>}{progress !== null && <p>{progress}</p>}{error && <p className="upload-error">{error}</p>}{success && <p className="upload-success">{success}</p>}</div><button className="button" disabled={!files.length || progress !== null}>Creează produsul merch</button></form>;
}

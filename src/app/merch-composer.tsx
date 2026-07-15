"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

export function MerchComposer({ brand }: { brand: "kaja" | "hexenwerk" }) {
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
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) { setFile(null); setError("Use a JPEG, PNG, or WebP image."); return; }
    if (selected.size > 10 * 1024 * 1024) { setFile(null); setError("Images must be 10 MB or smaller."); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected); setPreview(URL.createObjectURL(selected));
  }

  async function createMerch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) { setError("An image is required for every Merch item."); return; }
    setError(""); setSuccess(""); setProgress(0);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      await upload(`merch/${brand}/new-${crypto.randomUUID()}-${safeName}`, file, {
        access: "private",
        handleUploadUrl: "/api/merch-images",
        clientPayload: JSON.stringify({ brand, title: title.trim(), body: body.trim() }),
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });
      setTitle(""); setBody(""); setFile(null); setPreview(""); setSuccess("Merch item created.");
      if (input.current) input.current.value = "";
      window.setTimeout(() => router.refresh(), 900);
    } catch { setError("Image upload failed. No Merch item was created."); } finally { setProgress(null); }
  }

  return <form className="form merch-composer" onSubmit={createMerch}><input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} placeholder="Merch title" disabled={progress !== null} /><textarea value={body} onChange={(event) => setBody(event.target.value)} required maxLength={4000} placeholder="Describe this merch item." disabled={progress !== null} /><div className="image-uploader"><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} required disabled={progress !== null} /><p>Required: JPEG, PNG, or WebP · max 10 MB</p>{preview && <img className="merch-preview merch-preview--draft" src={preview} alt="New merch preview" />}{progress !== null && <p>Uploading {progress}%</p>}{error && <p className="upload-error">{error}</p>}{success && <p className="upload-success">{success}</p>}</div><button className="button" disabled={!file || progress !== null}>Create merch item</button></form>;
}

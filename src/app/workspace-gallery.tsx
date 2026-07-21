"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { FormEvent, TouchEvent, useEffect, useRef, useState } from "react";
import { createWorkspaceItem, deleteWorkspaceItemImage } from "./actions";
import { AutoResizeTextarea } from "./comment-textarea";
import { ConfirmDeleteButton } from "./confirm-delete-button";

type Brand = "kaja" | "hexenwerk" | "virginia";
type GallerySection = "events" | "catalogue" | "merch";
export type GalleryImage = { id: number; itemId: number; position: number };

const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

function validFiles(list: FileList | null) {
  const files = Array.from(list || []);
  const invalidType = files.some((file) => !acceptedTypes.includes(file.type));
  const oversized = files.some((file) => file.size > 10 * 1024 * 1024);
  return { files: invalidType || oversized ? [] : files, error: invalidType ? "Folosește doar imagini JPEG, PNG sau WebP." : oversized ? "Fiecare imagine trebuie să aibă maximum 10 MB." : "" };
}

async function appendImages(files: File[], brand: Brand, itemId: number, section: GallerySection, onProgress: (label: string) => void) {
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    await upload(`item-images/${brand}/${itemId}-${crypto.randomUUID()}-${safeName}`, file, {
      access: "private",
      handleUploadUrl: "/api/item-images",
      clientPayload: JSON.stringify({ mode: "append", brand, itemId, section }),
      onUploadProgress: ({ percentage }) => onProgress(`Imaginea ${index + 1}/${files.length} · ${Math.round(percentage)}%`),
    });
  }
}

export function GalleryComposer({ brand, section, catalogueGroup }: { brand: Brand; section: "events" | "catalogue"; catalogueGroup?: "live" | "upcoming" }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const label = section === "events" ? "eveniment" : catalogueGroup === "upcoming" ? "produs în curând" : "produs din catalog";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true); setError(""); setProgress("Se creează înregistrarea…");
    try {
      const data = new FormData(form);
      const created = await createWorkspaceItem(data);
      if (!created?.id) throw new Error("Înregistrarea nu a putut fi creată.");
      if (files.length) await appendImages(files, brand, created.id, section, setProgress);
      form.reset(); setFiles([]); setProgress("");
      if (input.current) input.current.value = "";
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Înregistrarea nu a putut fi creată complet.");
    } finally { setBusy(false); }
  }

  return <form className="form gallery-composer" onSubmit={submit}><input type="hidden" name="brand" value={brand} /><input type="hidden" name="section" value={section} />{catalogueGroup && <input type="hidden" name="catalogueGroup" value={catalogueGroup} />}<AutoResizeTextarea className="field-title" name="title" required maxLength={160} placeholder={`Titlu ${label}`} disabled={busy} /><AutoResizeTextarea name="body" required maxLength={4000} placeholder={`Descrie ${label}.`} disabled={busy} /><div className="image-uploader"><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(event) => { const selected = validFiles(event.target.files); setFiles(selected.files); setError(selected.error); }} /><p>Opțional: JPEG, PNG sau WebP · maximum 10 MB per imagine</p>{files.length > 0 && <p>{files.length} {files.length === 1 ? "imagine selectată" : "imagini selectate"}</p>}{progress && <p>{progress}</p>}{error && <p className="upload-error">{error}</p>}</div><button className="button" disabled={busy || Boolean(error)}>Adaugă</button></form>;
}

export function EntryGallery({ brand, section, itemId, title, images, canManage }: { brand: Brand; section: GallerySection; itemId: number; title: string; images: GalleryImage[]; canManage: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const touchStart = useRef<number | null>(null);
  const current = images[active];

  useEffect(() => { if (active >= images.length) setActive(Math.max(0, images.length - 1)); }, [active, images.length]);
  const previous = () => setActive((value) => (value - 1 + images.length) % images.length);
  const next = () => setActive((value) => (value + 1) % images.length);
  const finishSwipe = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStart.current === null || images.length < 2) return;
    const distance = event.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(distance) > 45) distance > 0 ? previous() : next();
    touchStart.current = null;
  };

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!files.length) return;
    setBusy(true); setError("");
    try {
      await appendImages(files, brand, itemId, section, setProgress);
      setFiles([]); setProgress("");
      if (input.current) input.current.value = "";
      router.refresh();
    } catch { setError("Imaginile nu au putut fi încărcate."); } finally { setBusy(false); }
  }

  return <section className="entry-gallery" aria-label={`Galerie ${title}`}>{current && <><div className="gallery-stage" onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }} onTouchEnd={finishSwipe}><img key={current.id} src={`/api/item-images/${current.id}`} alt={`${title} · imaginea ${active + 1}`} />{images.length > 1 && <><button type="button" className="gallery-arrow gallery-arrow--left" onClick={previous} aria-label="Imaginea precedentă">‹</button><button type="button" className="gallery-arrow gallery-arrow--right" onClick={next} aria-label="Imaginea următoare">›</button></>}</div>{images.length > 1 && <div className="gallery-thumbnails">{images.map((image, index) => <button type="button" key={image.id} className={index === active ? "active" : undefined} onClick={() => setActive(index)} aria-label={`Afișează imaginea ${index + 1}`} aria-current={index === active ? "true" : undefined}><img src={`/api/item-images/${image.id}`} alt="" /></button>)}</div>}</>}
    {canManage && <div className="gallery-management">{current && !(section === "merch" && images.length === 1) && <form action={deleteWorkspaceItemImage}><input type="hidden" name="id" value={current.id} /><input type="hidden" name="itemId" value={itemId} /><input type="hidden" name="brand" value={brand} /><ConfirmDeleteButton className="button ghost danger" itemName="această imagine">Șterge imaginea</ConfirmDeleteButton></form>}<form className="gallery-upload-form" onSubmit={add}><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(event) => { const selected = validFiles(event.target.files); setFiles(selected.files); setError(selected.error); }} /><button className="button ghost" disabled={busy || !files.length || Boolean(error)}>Adaugă imagini</button>{progress && <p>{progress}</p>}{error && <p className="upload-error">{error}</p>}</form></div>}
  </section>;
}

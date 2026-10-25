"use client";

import { useActionState } from "react";
import { saveUploadFolder } from "./upload-folder-actions";

export function UploadFolderForm({ brand, folder }: { brand: string; folder?: { id: number; title: string; subtitle: string } }) {
  const [state, action, pending] = useActionState(saveUploadFolder, { error: "" });
  return <form action={action} className="upload-folder-form">
    {folder && <input type="hidden" name="id" value={folder.id} />}
    <label>Brand<select name="brand" defaultValue={brand} disabled={Boolean(folder)}><option value="kaja">KAJA</option><option value="hexenwerk">HEXENWERK</option><option value="virginia">LUMEN</option></select></label>
    {folder && <input type="hidden" name="brand" value={brand} />}
    <label>Titlu<input name="title" required maxLength={160} defaultValue={folder?.title} /></label>
    <label>Subtitlu<input name="subtitle" maxLength={300} defaultValue={folder?.subtitle} /></label>
    {state.error && <p role="alert">{state.error}</p>}
    <button className="button" disabled={pending}>{pending ? "Se salvează…" : folder ? "Salvează dosarul" : "Creează dosar"}</button>
  </form>;
}

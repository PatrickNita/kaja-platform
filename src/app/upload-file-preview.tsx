"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { prepareSharePng, sharePng } from "../lib/share-png";
import { useEntryModalState } from "./entry-modal-state";

export function UploadFileThumbnail({ id, filename, png }: { id: number; filename: string; png: boolean }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return <span className="upload-file-thumbnail" aria-label={failed ? `Preview indisponibil pentru ${filename}` : undefined}>
    {(!png || failed || !loaded) && <svg width="26" height="30" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 2h9l5 5v19H5Z M14 2v6h5 M8 14h8 M8 18h8" /></svg>}
    {png && !failed && <img className={loaded ? "is-loaded" : ""} loading="lazy" src={`/api/attachments/${id}?variant=thumb`} alt="" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
  </span>;
}

type Resource = { status: "loading" } | { status: "ready"; file: File; url: string } | { status: "error" };

export function UploadFilePreview({ id, filename, contentType, metadata, children }: { id: number; filename: string; contentType: string; metadata: string; children: ReactNode }) {
  const png = contentType === "image/png";
  const title = filename.replace(/\.(png|pdf)$/i, "");
  const [resource, setResource] = useState<Resource>({ status: "loading" });
  const [retry, setRetry] = useState(0);
  const [message, setMessage] = useState("");
  const [sharing, setSharing] = useState(false);
  const mounted = useRef(false);
  const { closeEntry, saving } = useEntryModalState();

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!png) return;
    const controller = new AbortController();
    let url: string | undefined;
    setResource({ status: "loading" });
    prepareSharePng(id, filename, controller.signal).then(file => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(file);
      setResource({ status: "ready", file, url });
    }).catch(() => {
      if (!controller.signal.aborted) setResource({ status: "error" });
    });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [id, filename, png, retry]);

  async function share() {
    if (resource.status !== "ready" || sharing || saving) return;
    setMessage(""); setSharing(true);
    try {
      const result = await sharePng(resource.file, navigator);
      if (mounted.current && result === "unsupported") setMessage("Acest browser nu permite distribuirea imaginilor. Folosește „Descarcă PNG”, apoi atașează imaginea în aplicația dorită.");
    } catch {
      if (mounted.current) setMessage("Distribuirea nu a putut fi deschisă. Încearcă din nou sau folosește „Descarcă PNG”.");
    } finally { if (mounted.current) setSharing(false); }
  }

  return <div className="upload-preview-dialog">
    <div className="entry-modal-header"><div className="entry-modal-title-group"><h2 className="item-title">{title}</h2></div><button type="button" className="entry-modal-close" data-entry-close aria-label={`Închide ${title}`} disabled={saving} onClick={() => closeEntry()}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div>
    <p className="meta upload-preview-meta">{metadata}</p>
    <div className="upload-preview-image" aria-busy={png && resource.status === "loading"}>
      {!png ? <div className="upload-preview-placeholder"><svg width="48" height="56" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 2h9l5 5v19H5Z M14 2v6h5 M8 14h8 M8 18h8" /></svg><p>Document PDF</p></div> : resource.status === "ready" ? <img src={resource.url} alt={`Preview ${title}`} onError={() => setResource({ status: "error" })} /> : resource.status === "loading" ? <p role="status">Se pregătește imaginea…</p> : <div className="upload-preview-placeholder"><p role="alert">Imaginea nu poate fi încărcată.</p><button className="button ghost" type="button" onClick={() => { setMessage(""); setRetry(value => value + 1); }}>Reîncearcă</button></div>}
    </div>
    {message && <p className="upload-share-message" role="status">{message}</p>}
    <div className="upload-preview-actions">
      {png && <button className="button ghost" type="button" onClick={share} disabled={resource.status !== "ready" || sharing || saving}>Share</button>}
      <a className="button ghost" href={`/api/attachments/${id}`} aria-disabled={saving || undefined} tabIndex={saving ? -1 : undefined} onClick={event => { if (saving) event.preventDefault(); }}>Descarcă {png ? "PNG" : "PDF"}</a>
      {children}
    </div>
  </div>;
}

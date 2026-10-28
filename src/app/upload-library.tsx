import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "../lib/db";
import { attachmentFolders, attachments } from "../lib/schema";
import { deleteAttachment } from "./actions";
import { ConfirmDeleteButton } from "./confirm-delete-button";
import { PdfUploader } from "./pdf-uploader";
import { UploadFolderForm } from "./upload-folder-form";
import { deleteUploadFolder } from "./upload-folder-actions";
import { ModalEntryCard, ModalEntryGrid } from "./merch-grid";
import { UploadFilePreview, UploadFileThumbnail } from "./upload-file-preview";

const brandLabels: Record<string, string> = { kaja: "KAJA", hexenwerk: "HEXENWERK", virginia: "LUMEN" };

export async function UploadLibrary({ brandFilter, memberSlug, folderParam }: { brandFilter: string; memberSlug: string; folderParam?: string }) {
  if (!db) return null;
  const manage = memberSlug === "patrick";
  const folders = await db.select().from(attachmentFolders).where(and(isNull(attachmentFolders.deletedAt), manage ? undefined : eq(attachmentFolders.published, true), brandFilter === "all" ? undefined : eq(attachmentFolders.brand, brandFilter))).orderBy(desc(attachmentFolders.createdAt));
  const selected = folderParam ? folders.find(folder => String(folder.id) === folderParam) : undefined;
  if (folderParam && !selected) notFound();
  const files = await db.select().from(attachments).where(and(isNull(attachments.deletedAt), selected ? eq(attachments.folderId, selected.id) : isNull(attachments.folderId), brandFilter === "all" ? undefined : eq(attachments.brand, brandFilter))).orderBy(attachments.filename);
  const counts = !selected && folders.length > 0 ? await db.select({ folderId: attachments.folderId, count: sql<number>`count(*)::int` }).from(attachments).where(and(isNull(attachments.deletedAt), or(...folders.map(folder => eq(attachments.folderId, folder.id))))).groupBy(attachments.folderId) : [];
  const base = `/?view=uploads&brand=${brandFilter}`;
  const title = selected?.title ?? (brandFilter === "all" ? "Toate încărcările" : `Încărcări ${brandLabels[brandFilter]}`);
  return <section className="panel content-section upload-library">
    {selected && <Link className="button ghost upload-back" href={base}>← Înapoi la încărcări</Link>}
    <div className="panel-head"><h1>{title} <span className="muted">({selected ? files.length : folders.length + files.length})</span></h1></div>
    {selected?.subtitle && <p className="upload-folder-subtitle">{selected.subtitle}</p>}
    {selected && !selected.published && <p>Dosar în pregătire · vizibil doar pentru Patrick</p>}
    {manage && <div className="upload-tools"><details className="composer-toggle"><summary>Încarcă fișier</summary><div className="composer-content"><PdfUploader key={`${selected?.id ?? "root"}-${brandFilter}`} initialBrand={(selected?.brand ?? (brandFilter === "all" ? "kaja" : brandFilter)) as "kaja" | "hexenwerk" | "virginia"} folderId={selected?.id} /></div></details>
      <details className="composer-toggle"><summary>{selected ? "Editează dosarul" : "Creează dosar"}</summary><div className="composer-content"><UploadFolderForm brand={selected?.brand ?? (brandFilter === "all" ? "kaja" : brandFilter)} folder={selected} /></div></details>
      {selected && files.length === 0 && <form action={deleteUploadFolder}><input type="hidden" name="id" value={selected.id} /><ConfirmDeleteButton itemName={selected.title}>Șterge dosarul gol</ConfirmDeleteButton></form>}
    </div>}
    {!selected && <div className="upload-folder-grid">{folders.map(folder => <Link className="item upload-folder-card" key={folder.id} href={`${base}&folder=${folder.id}`}><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /></svg><div><h2>{folder.title}</h2><p>{folder.subtitle}</p><span className="meta">{brandLabels[folder.brand]} · {counts.find(row => row.folderId === folder.id)?.count ?? 0} fișiere{!folder.published ? " · În pregătire" : ""}</span></div></Link>)}</div>}
    {selected ? <div className="upload-compact-files"><ModalEntryGrid entryIds={files.map(file => `attachment-${file.id}`)} label="Fișierele dosarului">{files.map(file => {
      const png = file.contentType === "image/png";
      const name = file.filename.replace(/\.(png|pdf)$/i, "");
      const metadata = `${brandLabels[file.brand]} · ${png ? "PNG" : "PDF"} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
      return <ModalEntryCard key={file.id} entryId={`attachment-${file.id}`} label={name} modalClassName="upload-preview-surface" preview={<div className="upload-compact-card"><UploadFileThumbnail id={file.id} filename={file.filename} png={png} /><div className="upload-compact-info"><h2>{name}</h2><span className="meta">{metadata}</span></div><svg className="upload-file-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></div>}>
        <UploadFilePreview id={file.id} filename={file.filename} contentType={file.contentType} metadata={metadata}>{manage && <form action={deleteAttachment}><input type="hidden" name="id" value={file.id} /><input type="hidden" name="brand" value={file.brand} /><input type="hidden" name="filename" value={file.filename} /><ConfirmDeleteButton itemName={file.filename}>Șterge</ConfirmDeleteButton></form>}</UploadFilePreview>
      </ModalEntryCard>;
    })}</ModalEntryGrid></div> : <div className="upload-file-grid">{files.map(file => <article className={`item upload-file-card ${file.contentType === "image/png" ? "upload-image-card" : ""}`} id={`attachment-${file.id}`} key={file.id}>
      {file.contentType === "image/png" && <a href={`/api/attachments/${file.id}?preview=1`} target="_blank" rel="noopener noreferrer" aria-label={`Vezi ${file.filename.replace(/\.png$/i, "")}`}><img loading="lazy" src={`/api/attachments/${file.id}?variant=preview`} alt={`Invitație ${file.filename.replace(/\.png$/i, "")}`} /></a>}
      <div className="upload-file-info"><h2>{file.filename.replace(/\.(png|pdf)$/i, "")}</h2><span className="meta">{brandLabels[file.brand]} · {file.contentType === "image/png" ? "PNG" : "PDF"} · {(file.size / 1024 / 1024).toFixed(1)} MB</span></div>
      <div className="attachment-actions"><a className="button ghost" href={`/api/attachments/${file.id}`}>Descarcă {file.contentType === "image/png" ? "PNG" : "PDF"}</a>{manage && <form action={deleteAttachment}><input type="hidden" name="id" value={file.id} /><input type="hidden" name="brand" value={file.brand} /><input type="hidden" name="filename" value={file.filename} /><ConfirmDeleteButton itemName={file.filename}>Șterge</ConfirmDeleteButton></form>}</div>
    </article>)}</div>}
    {files.length === 0 && (selected || folders.length === 0) && <p className="meta">Nu există fișiere în {selected ? "acest dosar" : "această listă"}.</p>}
  </section>;
}

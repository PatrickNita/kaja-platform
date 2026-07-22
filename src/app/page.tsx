import Image from "next/image";
import type { ReactNode } from "react";
import { currentMember } from "../lib/auth";
import { hasDatabase } from "../lib/db";
import { workspaceItems } from "../lib/schema";
import { createComment, createTask, createUpdate, createWorkspaceItemForm, deleteAttachment, deleteComment, deleteRecord, deleteWorkspaceItem, editUpdate, toggleCommentHeart, toggleEntryReaction, updateTask, updateWorkspaceItem, workspaceData } from "./actions";
import { AutoResizeTextarea, CommentTextarea } from "./comment-textarea";
import { ConfirmDeleteButton } from "./confirm-delete-button";
import { MerchComposer } from "./merch-composer";
import { ModalEntryGrid } from "./merch-grid";
import { MobileMenu } from "./mobile-menu";
import { PdfUploader } from "./pdf-uploader";
import { WelcomeIntro } from "./welcome-intro";
import { EntryGallery, GalleryComposer } from "./workspace-gallery";

export const dynamic = "force-dynamic";

const sections = [{ key: "updates", label: "Propuneri" }, { key: "tasks", label: "Sarcini" }, { key: "events", label: "Evenimente" }, { key: "catalogue", label: "Catalog" }, { key: "merch", label: "Merch" }, { key: "information", label: "Informații" }, { key: "uploads", label: "Încărcări" }] as const;
const brands = [{ key: "kaja", label: "KAJA" }, { key: "hexenwerk", label: "HEXENWERK" }, { key: "virginia", label: "VIRGINIA" }] as const;
const catalogueGroups = [{ key: "live", label: "Catalog activ" }, { key: "upcoming", label: "În curând" }, { key: "ideas", label: "Idei" }] as const;
type Section = (typeof sections)[number]["key"];
type Brand = (typeof brands)[number]["key"];
type CatalogueGroup = (typeof catalogueGroups)[number]["key"];
type Data = NonNullable<Awaited<ReturnType<typeof workspaceData>>>;
type WorkspaceItemRow = { item: typeof workspaceItems.$inferSelect; author: string; authorSlug: string };
type CommentRow = Data["comments"][number];
type ReactionRow = Data["reactions"][number];
type EntryReactionRow = Data["entryReactions"][number];
type CommentEntity = "update" | "task" | "events" | "catalogue" | "merch";
type EntryEntity = CommentEntity | "information";
type EntryReactionType = "heart" | "like" | "dislike" | "poop" | "question";

const entryReactionOptions = [
  { type: "heart", emoji: "❤️", label: "Inimă" },
  { type: "like", emoji: "👍", label: "Like" },
  { type: "dislike", emoji: "👎", label: "Dislike" },
  { type: "poop", emoji: "💩", label: "Căcat" },
  { type: "question", emoji: "❓", label: "Semn de întrebare" },
] as const satisfies ReadonlyArray<{ type: EntryReactionType; emoji: string; label: string }>;

function date(value: Date) { return new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Chisinau" }).format(value); }
function relativeTime(value: Date) { const minutes = Math.max(0, Math.floor((Date.now() - value.getTime()) / 60_000)); if (minutes < 1) return "Acum câteva secunde"; if (minutes < 60) return `Acum ${minutes} ${minutes === 1 ? "minut" : "minute"}`; const hours = Math.floor(minutes / 60); if (hours < 24) return `Acum ${hours} ${hours === 1 ? "oră" : "ore"}`; const days = Math.floor(hours / 24); return `Acum ${days} ${days === 1 ? "zi" : "zile"}`; }
function fileSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function canManage(memberSlug: string, authorSlug: string) { return memberSlug === "patrick" || memberSlug === authorSlug; }
function canManageWorkspace(memberSlug: string, authorSlug: string, section: string, catalogueGroup?: string | null) { return memberSlug === "patrick" || (memberSlug === authorSlug && section !== "information" && section !== "merch" && !(section === "catalogue" && catalogueGroup !== "ideas")); }
function preview(value: string) { return value.length > 50 ? `${value.slice(0, 50).trimEnd()}…` : value; }

function Composer({ label, children }: { label: string; children: ReactNode }) {
  return <details className="composer-toggle"><summary>{label}</summary><div className="composer-content">{children}</div></details>;
}

function Comments({ brand, entityType, entityId, comments, reactions, memberSlug }: { brand: Brand; entityType: CommentEntity; entityId: number; comments: CommentRow[]; reactions: ReactionRow[]; memberSlug: string }) {
  const own = comments.filter(({ comment }) => comment.entityType === entityType && comment.entityId === entityId);
  return <section className="comments">
    <h4>Comentarii ({own.length})</h4>
    <div className="comment-list">{own.map(({ comment, author, authorSlug }) => {
      const hearts = reactions.filter(({ reaction }) => reaction.commentId === comment.id);
      const hasHeart = hearts.some(({ memberSlug: slug }) => slug === memberSlug);
      return <div className="comment" key={comment.id}>
        <div className="comment-line"><b>{author}</b><p>{comment.body}</p><div className="comment-reactions"><form action={toggleCommentHeart}><input type="hidden" name="brand" value={brand} /><input type="hidden" name="commentId" value={comment.id} /><button className={`heart-button${hasHeart ? " active" : ""}`} aria-label={hasHeart ? "Retrage inima" : "Dă inimă"} aria-pressed={hasHeart}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z" /></svg></button></form>{hearts.length > 0 ? <details className="reaction-likers"><summary>{hearts.length}</summary><div>{hearts.map(({ reaction, memberName }) => <span key={reaction.id}>{memberName}</span>)}</div></details> : <span className="reaction-count">0</span>}</div><span className="comment-time">{relativeTime(comment.createdAt)}</span></div>
        {authorSlug === memberSlug && <form action={deleteComment}><input type="hidden" name="id" value={comment.id} /><input type="hidden" name="brand" value={brand} /><input type="hidden" name="entityType" value={entityType} /><input type="hidden" name="entityId" value={entityId} /><ConfirmDeleteButton className="text-button danger" itemName="acest comentariu">Șterge comentariul</ConfirmDeleteButton></form>}
      </div>;
    })}</div>
    <form action={createComment} className="comment-form"><input type="hidden" name="brand" value={brand} /><input type="hidden" name="entityType" value={entityType} /><input type="hidden" name="entityId" value={entityId} /><CommentTextarea /><button className="button">Comentează</button></form>
  </section>;
}

function EntryReactionPreview({ reactions }: { reactions: EntryReactionRow[] }) {
  const active = entryReactionOptions.map((option) => ({ ...option, count: reactions.filter(({ reaction }) => reaction.reactionType === option.type).length })).filter(({ count }) => count > 0);
  if (active.length === 0) return null;
  return <div className="entry-reaction-preview" aria-label="Reacții">{active.map(({ type, emoji, label, count }) => <span key={type} title={`${count} ${label.toLowerCase()}`}><span aria-hidden="true">{emoji}</span><b>{count}</b></span>)}</div>;
}

function EntryReactions({ brand, entityType, entityId, reactions, memberSlug }: { brand: Brand; entityType: EntryEntity; entityId: number; reactions: EntryReactionRow[]; memberSlug: string }) {
  return <section className="entry-reactions" aria-label="Reacții la înregistrare">{entryReactionOptions.map(({ type, emoji, label }) => {
    const selected = reactions.filter(({ reaction }) => reaction.reactionType === type);
    const active = selected.some(({ memberSlug: slug }) => slug === memberSlug);
    const names = selected.map(({ memberName }) => memberName);
    return <form action={toggleEntryReaction} key={type}>
      <input type="hidden" name="brand" value={brand} />
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="reactionType" value={type} />
      <button className={`entry-reaction-chip${active ? " active" : ""}${names.length > 0 ? " has-reactions" : ""}`} aria-label={`${active ? "Retrage" : "Adaugă"} reacția ${label}`} aria-pressed={active} title={names.length > 0 ? names.join(", ") : label}>
        <span className="entry-reaction-emoji" aria-hidden="true">{emoji}</span>
        {names.length > 0 && <span className="entry-reaction-names">{names.join(", ")}</span>}
      </button>
    </form>;
  })}</section>;
}

function EntryCard({ brand, type, id, title, body, author, comments, reactions, entryReactions, memberSlug, media, detailsMedia, modal = false, children }: { brand: Brand; type: EntryEntity; id: number; title: string; body?: string; author: string; comments?: CommentRow[]; reactions?: ReactionRow[]; entryReactions: EntryReactionRow[]; memberSlug: string; media?: ReactNode; detailsMedia?: ReactNode; modal?: boolean; children?: ReactNode }) {
  const commentType = type === "information" ? null : type;
  const own = commentType ? (comments || []).filter(({ comment }) => comment.entityType === commentType && comment.entityId === id) : [];
  const ownEntryReactions = entryReactions.filter(({ reaction }) => reaction.entityType === type && reaction.entityId === id);
  const last = own.at(-1);
  const compactPreview = <>{media}<div className="entry-card-head"><h3 className="item-title">{title}</h3><span className="entry-author">{author}</span></div>{body && <p className="entry-preview">{preview(body)}</p>}{commentType && <div className="comment-preview">Comentarii ({own.length}){last && <> · ({last.author} – {date(last.comment.createdAt)})</>}</div>}<EntryReactionPreview reactions={ownEntryReactions} /></>;
  return <><article className="item card entry-card-placeholder" aria-hidden="true">{compactPreview}</article><article className="item card entry-card-surface"><details id={`entry-${type}-${id}`} className="entry-card"><summary>{compactPreview}</summary>{modal && <div className="entry-modal-header"><div className="entry-modal-title-group"><h3 className="item-title">{title}</h3><span className="entry-author">{author}</span></div><button type="button" className="entry-modal-close" data-entry-close aria-label={`Închide ${title}`}>×</button></div>}<div className="entry-card-content">{detailsMedia}{body && <p>{body}</p>}<EntryReactions brand={brand} entityType={type} entityId={id} reactions={ownEntryReactions} memberSlug={memberSlug} />{commentType && <Comments brand={brand} entityType={commentType} entityId={id} comments={comments || []} reactions={reactions || []} memberSlug={memberSlug} />}{children}</div></details></article></>;
}

function WorkspaceActions({ brand, section, item, memberSlug, authorSlug }: { brand: Brand; section: "events" | "catalogue" | "merch" | "information"; item: WorkspaceItemRow["item"]; memberSlug: string; authorSlug: string }) {
  if (!canManageWorkspace(memberSlug, authorSlug, section, item.catalogueGroup)) return null;
  return <div className="card-actions"><details className="card-edit"><summary className="button ghost">Modifică</summary><form action={updateWorkspaceItem} className="form edit-form"><input type="hidden" name="id" value={item.id} /><input type="hidden" name="brand" value={brand} /><input type="hidden" name="section" value={section} /><AutoResizeTextarea className="field-title" name="title" defaultValue={item.title} required maxLength={160} /><AutoResizeTextarea name="body" defaultValue={item.body} required maxLength={4000} /><button className="button">Salvează modificările</button></form></details><form action={deleteWorkspaceItem}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="brand" value={brand} /><input type="hidden" name="section" value={section} /><input type="hidden" name="title" value={item.title} /><ConfirmDeleteButton itemName={item.title}>Șterge</ConfirmDeleteButton></form></div>;
}

function WorkspaceSection({ brand, section, title, items, images, comments, reactions, entryReactions, memberSlug, catalogueGroup, hideHeader = false }: { brand: Brand; section: "events" | "catalogue" | "merch" | "information"; title: string; items: WorkspaceItemRow[]; images: Data["images"]; comments: CommentRow[]; reactions: ReactionRow[]; entryReactions: EntryReactionRow[]; memberSlug: string; catalogueGroup?: CatalogueGroup; hideHeader?: boolean }) {
  const label = section === "catalogue" ? "produs din catalog" : title.toLowerCase();
  const toggleLabel = section === "merch" ? "Adaugă produs merch" : section === "information" ? "Adaugă informație" : `Adaugă ${label}`;
  const canCreate = memberSlug === "patrick" || (section === "catalogue" && catalogueGroup === "ideas");
  const galleryEnabled = section === "merch" || section === "events" || (section === "catalogue" && catalogueGroup !== "ideas");
  const modalEnabled = section === "information" || section === "catalogue" || galleryEnabled;
  const composer = section === "merch" ? <MerchComposer brand={brand} /> : galleryEnabled && (section === "events" || section === "catalogue") ? <GalleryComposer brand={brand} section={section} catalogueGroup={catalogueGroup === "ideas" ? undefined : catalogueGroup} /> : <form action={createWorkspaceItemForm} className="form"><input type="hidden" name="brand" value={brand} /><input type="hidden" name="section" value={section} />{catalogueGroup && <input type="hidden" name="catalogueGroup" value={catalogueGroup} />}<AutoResizeTextarea className="field-title" name="title" required maxLength={160} placeholder={`Titlu ${label}`} /><AutoResizeTextarea name="body" required maxLength={4000} placeholder={`Descrie ${label}.`} /><button className="button">Adaugă</button></form>;
  const cards = items.map(({ item, author, authorSlug }) => {
    const itemImages = images.filter((image) => image.itemId === item.id);
    const firstImage = itemImages[0];
    const manageable = canManageWorkspace(memberSlug, authorSlug, section, item.catalogueGroup);
    const media = firstImage ? <div className="entry-media-preview"><img src={`/api/item-images/${firstImage.id}`} alt={`Previzualizare ${item.title}`} />{itemImages.length > 1 && <span>{itemImages.length} imagini</span>}</div> : undefined;
    const detailsMedia = galleryEnabled ? <EntryGallery brand={brand} section={section as "events" | "catalogue" | "merch"} itemId={item.id} title={item.title} images={itemImages} canManage={manageable} /> : undefined;
    return <div key={item.id} className="card-wrap"><EntryCard brand={brand} type={section} id={item.id} title={item.title} body={item.body} author={author} comments={section === "information" ? undefined : comments} reactions={section === "information" ? undefined : reactions} entryReactions={entryReactions} memberSlug={memberSlug} media={media} detailsMedia={detailsMedia} modal={modalEnabled}><WorkspaceActions brand={brand} section={section} item={item} memberSlug={memberSlug} authorSlug={authorSlug} /></EntryCard></div>;
  });
  return <section className="panel content-section">{!hideHeader && <div className="panel-head"><h2>{title}</h2></div>}{canCreate && <Composer label={toggleLabel}>{composer}</Composer>}{modalEnabled ? <ModalEntryGrid label={title.toLowerCase()} twoColumnMobile={section === "merch"}>{cards}</ModalEntryGrid> : <div className="items card-grid">{cards}</div>}</section>;
}

function UpdatesSection({ brand, data, memberSlug }: { brand: Brand; data: Data; memberSlug: string }) {
  return <section className="panel content-section"><div className="panel-head"><h2>Propuneri</h2></div><Composer label="Adaugă propuneri"><form action={createUpdate} className="form"><input type="hidden" name="brand" value={brand} /><AutoResizeTextarea className="field-title" name="title" required maxLength={160} placeholder="Titlu actualizare" /><AutoResizeTextarea name="body" required maxLength={4000} placeholder="Spune ce s-a schimbat și ce urmează." /><button className="button">Publică propunerea</button></form></Composer><ModalEntryGrid label="propunerea">{data.updates.map(({ update, author, authorSlug }) => <div className="card-wrap" key={update.id}><EntryCard brand={brand} type="update" id={update.id} title={update.title} body={update.body} author={author} comments={data.comments} reactions={data.reactions} entryReactions={data.entryReactions} memberSlug={memberSlug} modal>{canManage(memberSlug, authorSlug) && <div className="card-actions"><details className="card-edit"><summary className="button ghost">Modifică</summary><form action={editUpdate} className="form edit-form"><input type="hidden" name="id" value={update.id} /><input type="hidden" name="brand" value={brand} /><AutoResizeTextarea className="field-title" name="title" defaultValue={update.title} required maxLength={160} /><AutoResizeTextarea name="body" defaultValue={update.body} required maxLength={4000} /><button className="button">Salvează modificările</button></form></details><form action={deleteRecord}><input type="hidden" name="id" value={update.id} /><input type="hidden" name="brand" value={brand} /><input type="hidden" name="type" value="update" /><input type="hidden" name="title" value={update.title} /><ConfirmDeleteButton itemName={update.title}>Șterge</ConfirmDeleteButton></form></div>}</EntryCard></div>)}</ModalEntryGrid></section>;
}

function TasksSection({ brand, data, memberSlug }: { brand: Brand; data: Data; memberSlug: string }) {
  return <section className="panel content-section"><div className="panel-head"><h2>Sarcini</h2></div><Composer label="Adaugă sarcină"><form action={createTask} className="form compact"><input type="hidden" name="brand" value={brand} /><AutoResizeTextarea className="field-title" name="title" required maxLength={160} placeholder="Adaugă o sarcină" /><button className="button">Adaugă sarcina</button></form></Composer><ModalEntryGrid label="sarcina">{data.tasks.map(({ task, author, authorSlug }) => <div className="card-wrap" key={task.id}><EntryCard brand={brand} type="task" id={task.id} title={task.title} author={author} comments={data.comments} reactions={data.reactions} entryReactions={data.entryReactions} memberSlug={memberSlug} modal>{canManage(memberSlug, authorSlug) && <div className="card-actions"><details className="card-edit"><summary className="button ghost">Modifică</summary><form action={updateTask} className="form edit-form"><input type="hidden" name="id" value={task.id} /><input type="hidden" name="brand" value={brand} /><AutoResizeTextarea className="field-title" name="title" defaultValue={task.title} required maxLength={160} /><button className="button">Salvează modificările</button></form></details><form action={deleteRecord}><input type="hidden" name="id" value={task.id} /><input type="hidden" name="brand" value={brand} /><input type="hidden" name="type" value="task" /><input type="hidden" name="title" value={task.title} /><ConfirmDeleteButton itemName={task.title}>Șterge</ConfirmDeleteButton></form></div>}</EntryCard></div>)}</ModalEntryGrid></section>;
}

function Activity({ data }: { data: Data }) {
  const target = (type: string, id: number, brand: Brand) => {
    if (type === "update") { const entry = data.updates.find(({ update }) => update.id === id)?.update; return entry && { title: entry.title, href: `/?brand=${brand}&view=updates#entry-update-${id}` }; }
    if (type === "task") { const entry = data.tasks.find(({ task }) => task.id === id)?.task; return entry && { title: entry.title, href: `/?brand=${brand}&view=tasks#entry-task-${id}` }; }
    if (type === "attachment") { const entry = data.attachments.find(({ attachment }) => attachment.id === id)?.attachment; return entry && { title: entry.filename, href: `/?brand=${brand}&view=uploads#attachment-${id}` }; }
    const entry = data.workspaceItems.find(({ item }) => item.id === id && item.section === type)?.item;
    if (!entry) return null;
    return { title: entry.title, href: `/?brand=${brand}&view=${entry.section}${entry.section === "catalogue" ? `&catalogue=${entry.catalogueGroup || "live"}` : ""}#entry-${entry.section}-${id}` };
  };
  return <aside className="panel activity-panel"><div className="panel-head"><h2>Activitate</h2></div><div className="activity">{data.activity.map(({ event, actor }) => { const entry = ["commented", "created", "uploaded", "edited", "updated", "image_uploaded", "image_deleted", "reacted"].includes(event.action) ? target(event.entityType, event.entityId, event.brand as Brand) : null; const text = event.action === "reacted" ? event.summary : event.action === "commented" ? `a comentat la ${entry?.title}` : event.action === "uploaded" ? `a încărcat ${entry?.title}` : event.action === "image_uploaded" ? `a adăugat o imagine la ${entry?.title}` : event.action === "image_deleted" ? `a șters o imagine din ${entry?.title}` : event.action === "edited" || event.action === "updated" ? `a modificat ${entry?.title}` : `a creat ${entry?.title}`; return <div className="event" key={event.id}><b>{actor}</b> {entry ? <a className="activity-link" href={entry.href}>{text}</a> : event.summary}</div>; })}</div></aside>;
}

function CatalogueSection({ brand, data, memberSlug, group }: { brand: Brand; data: Data; memberSlug: string; group: CatalogueGroup }) {
  const active = catalogueGroups.find((entry) => entry.key === group)!;
  return <><nav className="catalogue-submenu" aria-label="Grupe catalog">{catalogueGroups.map((entry) => <a key={entry.key} className={entry.key === group ? "active" : undefined} href={`/?brand=${brand}&view=catalogue&catalogue=${entry.key}`}>{entry.label}</a>)}</nav><WorkspaceSection brand={brand} section="catalogue" title={active.label} catalogueGroup={group} hideHeader items={data.workspaceItems.filter(({ item }) => item.section === "catalogue" && item.catalogueGroup === group)} images={data.images} comments={data.comments} reactions={data.reactions} entryReactions={data.entryReactions} memberSlug={memberSlug} /></>;
}

function UploadsSection({ brand, data, memberSlug }: { brand: Brand; data: Data; memberSlug: string }) {
  const canManagePdfs = memberSlug === "patrick";
  return <section className="panel content-section"><div className="panel-head"><h2>Încărcări</h2></div>{canManagePdfs && <Composer label="Încarcă PDF"><PdfUploader brand={brand} /></Composer>}<div className="items attachment-grid">{data.attachments.map(({ attachment, author }) => <article id={`attachment-${attachment.id}`} key={attachment.id} className="item attachment"><div><h3 className="item-title">{attachment.filename}</h3><div className="meta"><span>Încărcat de {author}</span><span>·</span><span>{fileSize(attachment.size)}</span></div></div><div className="attachment-actions"><a className="button ghost" href={`/api/attachments/${attachment.id}`}>Descarcă PDF</a>{canManagePdfs && <form action={deleteAttachment}><input type="hidden" name="id" value={attachment.id} /><input type="hidden" name="brand" value={brand} /><input type="hidden" name="filename" value={attachment.filename} /><ConfirmDeleteButton itemName={attachment.filename}>Șterge</ConfirmDeleteButton></form>}</div></article>)}</div></section>;
}

export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string; brand?: string; catalogue?: string }> }) {
  const member = await currentMember();
  if (!member) return <main className="landing"><section className="landing-card"><Image className="logo" src="/kaja-logo.png" alt="KAJA" width={1024} height={240} priority /><p className="eyebrow">Platformă internă pentru membri</p><h1>O imagine comună asupra muncii.</h1><p>Folosește linkul personal KAJA pentru a intra în spațiul de lucru.</p>{!hasDatabase && <div className="setup">Configurarea bazei de date este în așteptare.</div>}</section></main>;
  const params = await searchParams;
  const brand: Brand = brands.some((entry) => entry.key === params.brand) ? params.brand as Brand : "kaja";
  const view: Section = sections.some((entry) => entry.key === params.view) ? params.view as Section : "tasks";
  const group: CatalogueGroup = catalogueGroups.some((entry) => entry.key === params.catalogue) ? params.catalogue as CatalogueGroup : "live";
  const data = await workspaceData(brand);
  if (!data) return <main className="landing">Este necesară baza de date.</main>;
  const sectionItems = data.workspaceItems.filter(({ item }) => item.section === view);
  const content = view === "updates" ? <><UpdatesSection brand={brand} data={data} memberSlug={member.slug} /><Activity data={data} /></> : view === "tasks" ? <TasksSection brand={brand} data={data} memberSlug={member.slug} /> : view === "catalogue" ? <CatalogueSection brand={brand} data={data} memberSlug={member.slug} group={group} /> : view === "uploads" ? <UploadsSection brand={brand} data={data} memberSlug={member.slug} /> : <WorkspaceSection brand={brand} section={view} title={sections.find((entry) => entry.key === view)!.label} items={sectionItems} images={data.images} comments={data.comments} reactions={data.reactions} entryReactions={data.entryReactions} memberSlug={member.slug} />;
  return <><WelcomeIntro memberName={member.name} memberSlug={member.slug} /><main className="workspace-shell"><header className="workspace-header"><div className="workspace-brand"><Image className="logo" src="/kaja-logo.png" alt="KAJA" width={1024} height={240} priority /><div className="identity"><span className="dot" /> {member.name}</div></div><nav className="brand-switcher" aria-label="Spații de brand">{brands.map((entry) => <a key={entry.key} href={`/?brand=${entry.key}&view=${view}${view === "catalogue" ? `&catalogue=${group}` : ""}`} className={brand === entry.key ? "active" : undefined}>{entry.label}</a>)}</nav><nav className="workspace-nav" aria-label="Secțiuni de lucru">{sections.map((entry) => <a key={entry.key} href={`/?brand=${brand}&view=${entry.key}${entry.key === "catalogue" ? `&catalogue=${group}` : ""}`} className={view === entry.key ? "active" : undefined}>{entry.label}</a>)}</nav></header><MobileMenu brand={brand} view={view} catalogue={group} /><div className="workspace-content">{content}</div></main></>;
}

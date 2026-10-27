import { CatalogueComposerProvider, CatalogueComposer, CatalogueAddButton } from "./catalogue-composer";
import { ProductTable } from "./product-table";
import { NavigationIcon } from "./navigation-icon";
import { ProductListSort, ProductListThumbnail } from "./product-list-controls";
import { normalizeProductSort, sortProductList, matchesProductSearch } from "../lib/product-list-sort";
import { CatalogueMissingLocations } from "./catalogue-missing-locations";
import { productUsageLabel } from "../lib/catalogue-usage";
import Image from "next/image";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { currentMember } from "../lib/auth";
import { hasDatabase } from "../lib/db";
import { workspaceItems } from "../lib/schema";
import { activityData, createComment, createWorkspaceItemForm, deleteComment, deleteRecord, deleteWorkspaceItem, editUpdate, setTaskAssignee, setTaskAssigneeCompletion, taskWorkspaceData, toggleCommentHeart, toggleEntryAttention, toggleEntryReaction, updateTask, updateWorkspaceItem, workspaceData } from "./actions";
import { AutoResizeTextarea, CommentTextarea } from "./comment-textarea";
import { ConfirmDeleteButton } from "./confirm-delete-button";
import { MemberDashboard } from "./member-dashboard";
import { BrandFormPicker } from "./brand-picker";
import { EntryInlineEditor } from "./entry-inline-editor";
import { FilterLink } from "./filter-link";
import { MerchComposer } from "./merch-composer";
import { ModalEntryCard, ModalEntryGrid } from "./merch-grid";
import { WorkspaceHeader } from "./workspace-header";
import { MobileMenu } from "./mobile-menu";
import { UploadLibrary } from "./upload-library";
import { TaskComposer } from "./task-composer";
import { EntryGallery, GalleryComposer } from "./workspace-gallery";

export const dynamic = "force-dynamic";

const sections = [{ key: "activity", label: "ACTIVITATE" }, { key: "tasks", label: "Sarcini" }, { key: "events", label: "Evenimente" }, { key: "catalogue", label: "Catalog" }, { key: "merch", label: "Merch" }, { key: "information", label: "Informații" }, { key: "uploads", label: "Încărcări" }] as const;
const brands = [{ key: "kaja", label: "KAJA" }, { key: "hexenwerk", label: "HEXENWERK" }, { key: "virginia", label: "LUMEN" }] as const;
const catalogueGroups = [{ key: "live", label: "Catalog activ" }, { key: "upcoming", label: "În curând" }, { key: "ideas", label: "Idei de gusturi" }] as const;
const taskViews = [{ key: "all", label: "Toate sarcinile" }, { key: "mine", label: "Sarcinile mele" }, { key: "history", label: "Istoric sarcini" }] as const;
const brandFilters = [{ key: "all", label: "Toate brand-urile" }, ...brands] as const;
type Section = (typeof sections)[number]["key"];
type Brand = (typeof brands)[number]["key"];
type CatalogueGroup = (typeof catalogueGroups)[number]["key"];
type TaskView = (typeof taskViews)[number]["key"];
type BrandFilter = (typeof brandFilters)[number]["key"];
type Data = NonNullable<Awaited<ReturnType<typeof workspaceData>>>;
type TaskData = NonNullable<Awaited<ReturnType<typeof taskWorkspaceData>>>;
type ActivityData = Awaited<ReturnType<typeof activityData>>;
type WorkspaceItemRow = { item: typeof workspaceItems.$inferSelect; author: string; authorSlug: string; locationCount?: number; totalLocationCount?: number };
type CommentRow = Data["comments"][number];
type ReactionRow = Data["reactions"][number];
type EntryReactionRow = Data["entryReactions"][number];
type AttentionRow = Data["attention"][number];
type TaskAssigneeRow = TaskData["taskAssignees"][number];
type CommentEntity = "update" | "task" | "events" | "catalogue" | "merch";
type EntryEntity = CommentEntity | "information";
type EntryReactionType = "heart" | "like" | "dislike" | "poop" | "question";
type EntryEditConfig = {
  flavor?: string;
  action: (formData: FormData) => Promise<void>;
  hiddenFields: Array<{ name: string; value: string | number }>;
  deleteControl: ReactNode;
};

const entryReactionOptions = [
  { type: "heart", emoji: "❤️", label: "Inimă" },
  { type: "like", emoji: "👍", label: "Like" },
  { type: "dislike", emoji: "👎", label: "Dislike" },
  { type: "poop", emoji: "💩", label: "Căcat" },
  { type: "question", emoji: "❓", label: "Semn de întrebare" },
] as const satisfies ReadonlyArray<{ type: EntryReactionType; emoji: string; label: string }>;

function date(value: Date) { return new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Chisinau" }).format(value); }
function relativeTime(value: Date) { const minutes = Math.max(0, Math.floor((Date.now() - value.getTime()) / 60_000)); if (minutes < 1) return "Acum câteva secunde"; if (minutes < 60) return `Acum ${minutes} ${minutes === 1 ? "minut" : "minute"}`; const hours = Math.floor(minutes / 60); if (hours < 24) return `Acum ${hours} ${hours === 1 ? "oră" : "ore"}`; const days = Math.floor(hours / 24); return `Acum ${days} ${days === 1 ? "zi" : "zile"}`; }
function canManage(memberSlug: string, authorSlug: string) { return memberSlug === "patrick" || memberSlug === authorSlug; }
function canManageWorkspace(memberSlug: string, authorSlug: string, section: string, catalogueGroup?: string | null) { return memberSlug === "patrick" || (memberSlug === authorSlug && section !== "information" && section !== "merch" && !(section === "catalogue" && catalogueGroup !== "ideas")); }
function preview(value: string) { return value.length > 50 ? `${value.slice(0, 50).trimEnd()}…` : value; }
function hasAttention(rows: AttentionRow[], brand: Brand, entityType: EntryEntity, entityId: number) { return rows.some(({ event }) => event.brand === brand && event.entityType === entityType && event.entityId === entityId); }
function initialBrand(filter: BrandFilter): Brand | undefined { return filter === "all" ? undefined : filter; }
function selectedBrandLabel(filter: BrandFilter) { return brands.find(({ key }) => key === filter)?.label ?? ""; }

function pageTitle({ view, brand, tasks = "all", catalogue = "live" }: { view: Section; brand: BrandFilter; tasks?: TaskView; catalogue?: CatalogueGroup }) {
  const brandLabel = selectedBrandLabel(brand);
  if (view === "activity") return "ACTIVITATE";
  if (view === "tasks") {
    if (tasks === "history") return "Istoric sarcini";
    if (tasks === "mine") return brand === "all" ? "Toate sarcinile mele" : `Sarcinile mele în ${brandLabel}`;
    return brand === "all" ? "Toate sarcinile" : `Toate sarcinile în ${brandLabel}`;
  }
  if (view === "events") return brand === "all" ? "Toate evenimentele" : `Evenimente ${brandLabel}`;
  if (view === "catalogue") {
    if (catalogue === "upcoming") return brand === "all" ? "Gusturi lansate în curând" : `Gusturi lansate în curând la ${brandLabel}`;
    if (catalogue === "ideas") return brand === "all" ? "Toate ideile de gusturi" : `Idei de gusturi la ${brandLabel}`;
    return brand === "all" ? "Catalog activ complet" : `Catalog activ ${brandLabel}`;
  }
  if (view === "merch") return brand === "all" ? "Merch complet" : `Merch ${brandLabel}`;
  if (view === "information") return brand === "all" ? "Toate informațiile" : `Informații ${brandLabel}`;
  return brand === "all" ? "Toate încărcările" : `Încărcări ${brandLabel}`;
}

function PageHeading({ title, count }: { title: string; count: number }) {
  return <h2>{title} <span className="page-entry-count">({count})</span></h2>;
}

function BrandBadge({ brand }: { brand: Brand }) {
  return <span className="task-brand-badge">{brands.find(({ key }) => key === brand)?.label ?? brand.toUpperCase()}</span>;
}

function InlineBrand({ brand, separated = true }: { brand: Brand; separated?: boolean }) {
  return <>{separated && <span className="entry-author-divider" aria-hidden="true">|</span>}<span className="entry-brand-inline">{selectedBrandLabel(brand)}</span></>;
}

function BrandFilterNav({ selected, view, catalogue, tasks, activity = false }: { selected: BrandFilter; view: Section; catalogue?: CatalogueGroup; tasks?: TaskView; activity?: boolean | "external" | "internal" | "deleted" }) {
  return <nav className="catalogue-submenu filter-nav brand-filter-nav" aria-label="Filtrează după brand">{brandFilters.map((entry) => {
    const query = new URLSearchParams({ brand: entry.key, view });
    if (view === "catalogue") query.set("catalogue", catalogue ?? "live");
    if (view === "tasks") query.set("tasks", tasks ?? "all");
    if (view === "activity" && activity) query.set("activity", typeof activity === "string" ? activity : "all");
    return <FilterLink key={entry.key} className={entry.key === selected ? "active" : undefined} href={`/?${query}`}>{entry.key === "all" ? "Toate" : entry.label}</FilterLink>;
  })}</nav>;
}

function Composer({ label, children }: { label: string; children: ReactNode }) {
  return <details className={"composer-toggle" + (label === "Adaugă produs nou" ? " catalogue-composer" : "")}><summary>{label}</summary><div className="composer-content">{children}</div></details>;
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

function AttentionControl({ brand, entityType, entityId, active, interactive }: { brand: Brand; entityType: EntryEntity; entityId: number; active: boolean; interactive: boolean }) {
  if (!interactive) return active ? <span className="attention-indicator" aria-label="Solicită mai multă atenție" title="Solicită mai multă atenție">⚠️</span> : null;
  return <form action={toggleEntryAttention} className="attention-form">
    <input type="hidden" name="brand" value={brand} />
    <input type="hidden" name="entityType" value={entityType} />
    <input type="hidden" name="entityId" value={entityId} />
    <button type="submit" className={`attention-toggle${active ? " active" : ""}`} aria-pressed={active} aria-label={active ? "Retrage solicitarea de atenție" : "Solicită mai multă atenție"} title={active ? "Retrage solicitarea de atenție" : "Solicită mai multă atenție"}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5 22 20.5H2L12 3.5Z" />
        <path d="M12 9v5.5" />
        <circle cx="12" cy="17.5" r=".8" />
      </svg>
    </button>
  </form>;
}

function EntryCard({ rowPreview, productFlavor, headerExtra, brand, type, id, title, body, author, authorSlug, attentionActive, comments, reactions, entryReactions, memberSlug, media, detailsMedia, previewExtra, detailsExtra, entryReactionsEnabled = true, commentsEnabled = true, attentionEnabled = true, attentionInteractive, showAuthor = true, edit }: { rowPreview?: ReactNode; productFlavor?: string; headerExtra?: ReactNode; brand: Brand; type: EntryEntity; id: number; title: string; body?: string; author: string; authorSlug: string; attentionActive: boolean; comments?: CommentRow[]; reactions?: ReactionRow[]; entryReactions: EntryReactionRow[]; memberSlug: string; media?: ReactNode; detailsMedia?: ReactNode; previewExtra?: ReactNode; detailsExtra?: ReactNode; entryReactionsEnabled?: boolean; commentsEnabled?: boolean; attentionEnabled?: boolean; attentionInteractive?: boolean; showAuthor?: boolean; edit?: EntryEditConfig }) {
  const entryId = `entry-${type}-${id}`;
  const commentType = type === "information" || !commentsEnabled ? null : type;
  const own = commentType ? (comments || []).filter(({ comment }) => comment.entityType === commentType && comment.entityId === id) : [];
  const ownEntryReactions = entryReactionsEnabled ? entryReactions.filter(({ reaction }) => reaction.entityType === type && reaction.entityId === id) : [];
  const last = own.at(-1);
  const compactPreview = rowPreview ?? <div className="entry-preview-content">{media}<div className="entry-card-head"><h3 className="item-title">{title}</h3><span className="entry-author-group entry-preview-author">{showAuthor && <span className="entry-author">{author}</span>}<InlineBrand brand={brand} separated={showAuthor && type !== "catalogue"} />{attentionEnabled && <AttentionControl brand={brand} entityType={type} entityId={id} active={attentionActive} interactive={false} />}</span></div>{body && <p className="entry-preview">{preview(body)}</p>}{commentType && <div className="comment-preview">Comentarii ({own.length}){last && <> · ({last.author} – {date(last.comment.createdAt)})</>}</div>}{previewExtra}{entryReactionsEnabled && <EntryReactionPreview reactions={ownEntryReactions} />}</div>;
  const authorControls = <span className="entry-author-group">{showAuthor && <span className="entry-author">{author}</span>}<InlineBrand brand={brand} separated={showAuthor && type !== "catalogue"} />{attentionEnabled && <AttentionControl brand={brand} entityType={type} entityId={id} active={attentionActive} interactive={attentionInteractive ?? memberSlug === authorSlug} />}</span>;
  const interactiveContent = <>{detailsExtra}{entryReactionsEnabled && <EntryReactions brand={brand} entityType={type} entityId={id} reactions={ownEntryReactions} memberSlug={memberSlug} />}{commentType && <Comments brand={brand} entityType={commentType} entityId={id} comments={comments || []} reactions={reactions || []} memberSlug={memberSlug} />}</>;
  return <ModalEntryCard entryId={entryId} label={title} preview={compactPreview}>
    <EntryInlineEditor entryId={entryId} title={title} body={body} authorControls={authorControls} closeLabel={`Închide ${title}`} detailsMedia={detailsMedia} editAction={edit?.action} flavor={productFlavor ?? edit?.flavor} headerExtra={headerExtra} hiddenFields={edit?.hiddenFields} deleteControl={edit?.deleteControl}>{interactiveContent}</EntryInlineEditor>
  </ModalEntryCard>;
}

function recordEditConfig({ brand, type, id, title: itemTitle, action, allowed }: { brand: Brand; type: "update" | "task"; id: number; title: string; action: (formData: FormData) => Promise<void>; allowed: boolean }): EntryEditConfig | undefined {
  if (!allowed) return undefined;
  return {
    action,
    hiddenFields: [{ name: "id", value: id }, { name: "brand", value: brand }],
    deleteControl: <form action={deleteRecord}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="brand" value={brand} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="title" value={itemTitle} />
      <ConfirmDeleteButton itemName={itemTitle}>Șterge</ConfirmDeleteButton>
    </form>,
  };
}

function workspaceEditConfig({ brand, section, item, memberSlug, authorSlug }: { brand: Brand; section: "events" | "catalogue" | "merch" | "information"; item: WorkspaceItemRow["item"]; memberSlug: string; authorSlug: string }): EntryEditConfig | undefined {
  if (!canManageWorkspace(memberSlug, authorSlug, section, item.catalogueGroup)) return undefined;
  return {
    action: updateWorkspaceItem,
    flavor: section === "catalogue" && item.catalogueGroup !== "ideas" ? item.flavor ?? "" : undefined,
    hiddenFields: [{ name: "id", value: item.id }, { name: "brand", value: brand }, { name: "section", value: section }],
    deleteControl: <form action={deleteWorkspaceItem}>
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="brand" value={brand} />
      <input type="hidden" name="section" value={section} />
      <input type="hidden" name="title" value={item.title} />
      <ConfirmDeleteButton itemName={item.title}>Șterge</ConfirmDeleteButton>
    </form>,
  };
}

function WorkspaceSection({ brandFilter, section, title, displayTitle, items, images, comments, reactions, entryReactions, attention, memberSlug, catalogueGroup, showBrandFilter = true }: { brandFilter: BrandFilter; section: "events" | "catalogue" | "merch" | "information"; title: string; displayTitle: string; items: WorkspaceItemRow[]; images: Data["images"]; comments: CommentRow[]; reactions: ReactionRow[]; entryReactions: EntryReactionRow[]; attention: AttentionRow[]; memberSlug: string; catalogueGroup?: CatalogueGroup; showBrandFilter?: boolean }) {
  const label = section === "catalogue" ? "produs din catalog" : title.toLowerCase();
  const toggleLabel = section === "merch" ? "Adaugă produs merch" : section === "information" ? "Adaugă informație" : section === "catalogue" ? "Adaugă produs nou" : `Adaugă ${label}`;
  const canCreate = memberSlug === "patrick" || (section === "catalogue" && catalogueGroup === "ideas");
  const galleryEnabled = section === "merch" || section === "events" || (section === "catalogue" && catalogueGroup !== "ideas");
  const modalEnabled = section === "information" || section === "catalogue" || galleryEnabled;
  const composer = section === "merch" ? <MerchComposer initialBrand={initialBrand(brandFilter)} /> : galleryEnabled && (section === "events" || section === "catalogue") ? <GalleryComposer initialBrand={initialBrand(brandFilter)} section={section} catalogueGroup={catalogueGroup === "ideas" ? undefined : catalogueGroup} /> : <form action={createWorkspaceItemForm} className="form"><BrandFormPicker initialBrand={initialBrand(brandFilter)} /><input type="hidden" name="section" value={section} />{catalogueGroup && <input type="hidden" name="catalogueGroup" value={catalogueGroup} />}<AutoResizeTextarea className="field-title" name="title" required maxLength={160} placeholder={`Titlu ${label}`} /><AutoResizeTextarea name="body" required maxLength={4000} placeholder={`Descrie ${label}.`} /><button className="button">Adaugă</button></form>;
  const tableUsage = section === "catalogue" && catalogueGroup === "live" && (brandFilter === "all" || brandFilter === "kaja");
  const tableIdeas = section === "catalogue" && catalogueGroup === "ideas";
  const cards = items.map(({ item, author, authorSlug, locationCount, totalLocationCount }) => {
    const usageOnly = item.brand === "kaja" && section === "catalogue" && item.catalogueGroup === "live";
    const usage = usageOnly ? <p className="meta">{productUsageLabel(locationCount ?? 0, totalLocationCount ?? 0)}</p> : undefined;
    const itemBrand = item.brand as Brand;
    const itemImages = images.filter((image) => image.itemId === item.id);
    const firstImage = itemImages[0];
    const manageable = canManageWorkspace(memberSlug, authorSlug, section, item.catalogueGroup);
    const media = firstImage ? <div className="entry-media-preview"><img src={`/api/item-images/${firstImage.id}`} alt={`Previzualizare ${item.title}`} />{itemImages.length > 1 && <span>{itemImages.length} imagini</span>}</div> : undefined;
    const detailsMedia = galleryEnabled ? <EntryGallery brand={itemBrand} section={section as "events" | "catalogue" | "merch"} itemId={item.id} title={item.title} images={itemImages} canManage={manageable} /> : undefined;
    return <article key={item.id} role={section === "catalogue" ? "row" : undefined} className={"card-wrap" + (section === "catalogue" ? " catalogue-list-card workspace-data-entry" : "")}><EntryCard rowPreview={section === "catalogue" ? <div className="product-list-row workspace-data-row"><span className="product-table-product workspace-data-identity" role="cell"><ProductListThumbnail imageId={firstImage?.id} title={item.title} /><strong className="item-title workspace-data-title">{item.title}</strong>{!usageOnly && hasAttention(attention, itemBrand, section, item.id) && <span className="attention-indicator" aria-label="Solicită mai multă atenție">⚠️</span>}</span><span className="product-table-flavor product-list-secondary" role="cell">{tableIdeas ? preview(item.body) : item.flavor || "—"}</span><span className="product-table-brand" role="cell"><InlineBrand brand={itemBrand} separated={false} /></span>{tableIdeas && <span className="product-table-author product-list-secondary" role="cell">{author}</span>}{tableUsage && <span className="product-table-usage product-list-secondary" role="cell">{usageOnly ? productUsageLabel(locationCount ?? 0,totalLocationCount ?? 0) : "—"}</span>}<span className="product-table-chevron" role="cell"><NavigationIcon name="chevron" /></span></div> : undefined} brand={itemBrand} type={section} id={item.id} title={item.title} body={item.body} author={author} authorSlug={authorSlug} attentionActive={hasAttention(attention, itemBrand, section, item.id)} comments={section === "information" ? undefined : comments} reactions={section === "information" ? undefined : reactions} entryReactions={entryReactions} memberSlug={memberSlug} commentsEnabled={!usageOnly} entryReactionsEnabled={!usageOnly} attentionEnabled={!usageOnly} previewExtra={usage} productFlavor={section === "catalogue" && item.catalogueGroup !== "ideas" ? item.flavor ?? "" : undefined} headerExtra={usage} detailsExtra={usageOnly ? <CatalogueMissingLocations itemId={item.id} /> : undefined} media={media} detailsMedia={detailsMedia} showAuthor={section === "catalogue" && item.catalogueGroup === "ideas"} edit={workspaceEditConfig({ brand: itemBrand, section, item, memberSlug, authorSlug })} /></article>;
  });
  const entryIds = items.map(({ item }) => `entry-${section}-${item.id}`);
  return <>{showBrandFilter && <BrandFilterNav selected={brandFilter} view={section} />}<section className={"panel content-section" + (section === "catalogue" ? " catalogue-list" : "")}>{section !== "catalogue" && <div className="panel-head"><PageHeading title={displayTitle} count={cards.length} /></div>}{section === "catalogue" && <ProductListSort catalogue canCreate={canCreate} />}{canCreate && (section === "catalogue" ? <CatalogueComposer>{composer}</CatalogueComposer> : <Composer label={toggleLabel}>{composer}</Composer>)}{section === "catalogue" ? <ProductTable label="Lista produselor din catalog" variant={tableIdeas ? "product-table--ideas" : tableUsage ? "product-table--usage" : ""} columns={[tableIdeas ? "Idee" : "Produs",tableIdeas ? "Descriere" : "Gust","Brand",...(tableIdeas ? ["Autor"] : tableUsage ? ["Utilizare în localuri"] : [])]}><ModalEntryGrid entryIds={entryIds} label={title.toLowerCase()}>{cards}</ModalEntryGrid></ProductTable> : modalEnabled ? <ModalEntryGrid entryIds={entryIds} label={title.toLowerCase()} twoColumnMobile={section === "merch"}>{cards}</ModalEntryGrid> : <div className="items card-grid">{cards}</div>}{section === "catalogue" && !cards.length && <p className="empty-state" role="status">Nu există produse pentru filtrele selectate.</p>}</section></>;
}

function LegacyProposalDetails({ data, memberSlug }: { data: Data; memberSlug: string }) {
  return <>
    <div hidden><ModalEntryGrid entryIds={data.updates.map(({ update }) => `entry-update-${update.id}`)} label="propunerea">{data.updates.map(({ update, author, authorSlug }) => {
      const updateBrand = update.brand as Brand;
      return <article className="card-wrap" key={update.id}>
        <EntryCard brand={updateBrand} type="update" id={update.id} title={update.title} body={update.body} author={author} authorSlug={authorSlug} attentionActive={hasAttention(data.attention, updateBrand, "update", update.id)} comments={data.comments} reactions={data.reactions} entryReactions={data.entryReactions} memberSlug={memberSlug} edit={recordEditConfig({ brand: updateBrand, type: "update", id: update.id, title: update.title, action: editUpdate, allowed: canManage(memberSlug, authorSlug) })} />
      </article>;
    })}</ModalEntryGrid></div>
  </>;
}

function TaskMemberBadges({ assignments, label = true }: { assignments: TaskAssigneeRow[]; label?: boolean }) {
  return <div className="task-assignee-preview">
    {label && <span className="task-assignee-label">Responsabili</span>}
    <div className="task-assignee-list">{assignments.map(({ assignment, memberName }) => <span key={assignment.id} className={`task-member-chip ${assignment.completed ? "completed" : "incomplete"}`}>
      <span aria-hidden="true">{assignment.completed ? "✓" : "×"}</span>
      {memberName}
    </span>)}</div>
  </div>;
}

function TaskAssigneeManager({ brand, taskId, assignments, members: allMembers, canManage }: { brand: Brand; taskId: number; assignments: TaskAssigneeRow[]; members: TaskData["members"]; canManage: boolean }) {
  if (!canManage) return <section className="task-assignee-manager"><h4>Responsabili</h4><TaskMemberBadges assignments={assignments} label={false} /></section>;
  return <section className="task-assignee-manager">
    <h4>Responsabili</h4>
    <div className="task-assignee-list manager">{allMembers.map((member) => {
      const selected = assignments.find(({ assignment }) => assignment.memberId === member.id);
      if (!selected) return <form action={setTaskAssignee} key={member.id}>
        <input type="hidden" name="id" value={taskId} />
        <input type="hidden" name="brand" value={brand} />
        <input type="hidden" name="memberSlug" value={member.slug} />
        <input type="hidden" name="assigned" value="true" />
        <button className="task-member-chip unassigned" aria-label={`Adaugă responsabilul ${member.name}`}><span aria-hidden="true">+</span>{member.name}</button>
      </form>;
      return <div className={`task-member-control ${selected.assignment.completed ? "completed" : "incomplete"}`} key={member.id}>
        <form action={setTaskAssigneeCompletion}>
          <input type="hidden" name="id" value={taskId} />
          <input type="hidden" name="brand" value={brand} />
          <input type="hidden" name="memberSlug" value={member.slug} />
          <input type="hidden" name="completed" value={selected.assignment.completed ? "false" : "true"} />
          <button className={`task-member-chip ${selected.assignment.completed ? "completed" : "incomplete"}`} aria-label={`${selected.assignment.completed ? "Marchează nefinalizat" : "Marchează finalizat"} pentru ${member.name}`}><span aria-hidden="true">{selected.assignment.completed ? "✓" : "×"}</span>{member.name}</button>
        </form>
        <form action={setTaskAssignee}>
          <input type="hidden" name="id" value={taskId} />
          <input type="hidden" name="brand" value={brand} />
          <input type="hidden" name="memberSlug" value={member.slug} />
          <input type="hidden" name="assigned" value="false" />
          <button className="task-member-remove" disabled={assignments.length <= 1} aria-label={`Elimină responsabilul ${member.name}`}>×</button>
        </form>
      </div>;
    })}</div>
  </section>;
}

function TasksSection({ data, memberSlug, taskView, brandFilter }: { data: TaskData; memberSlug: string; taskView: TaskView; brandFilter: BrandFilter }) {
  const taskIsCompleted = (taskId: number) => {
    const assignments = data.taskAssignees.filter(({ assignment }) => assignment.taskId === taskId);
    return assignments.length > 0 && assignments.every(({ assignment }) => assignment.completed);
  };
  const visibleTasks = data.tasks.filter(({ task }) => {
    const completed = taskIsCompleted(task.id);
    if (taskView === "history") return completed;
    if (completed) return false;
    if (brandFilter !== "all" && task.brand !== brandFilter) return false;
    return taskView !== "mine" || data.taskAssignees.some(({ assignment, memberSlug: assignedSlug }) => assignment.taskId === task.id && assignedSlug === memberSlug);
  });
  const taskHref = (nextView: TaskView, nextBrand: BrandFilter) => `/?brand=${nextBrand}&view=tasks&tasks=${nextView}`;
  const availableViews = memberSlug === "patrick" ? taskViews : taskViews.filter(({ key }) => key !== "history");
  return <>
    <nav className="catalogue-submenu filter-nav task-submenu" aria-label="Filtre sarcini">{availableViews.map((entry) => <FilterLink key={entry.key} className={entry.key === taskView ? "active" : undefined} href={taskHref(entry.key, entry.key === "history" ? "all" : brandFilter)}>{entry.label}</FilterLink>)}</nav>
    {taskView !== "history" && <BrandFilterNav selected={brandFilter} view="tasks" tasks={taskView} />}
    <section className="panel content-section">
      <div className="panel-head"><PageHeading title={pageTitle({ view: "tasks", brand: brandFilter, tasks: taskView })} count={visibleTasks.length} /></div>
      {memberSlug === "patrick" && taskView !== "history" && <Composer label="Adaugă sarcină"><TaskComposer initialBrand={initialBrand(brandFilter)} members={data.members} /></Composer>}
      <ModalEntryGrid entryIds={visibleTasks.map(({ task }) => `entry-task-${task.id}`)} label="sarcina">{visibleTasks.map(({ task, author, authorSlug }) => {
        const assignments = data.taskAssignees.filter(({ assignment }) => assignment.taskId === task.id);
        const taskBrand = task.brand as Brand;
        const taskContext = <div className="task-card-context"><TaskMemberBadges assignments={assignments} /></div>;
        return <article className="card-wrap" key={task.id}>
          <EntryCard brand={taskBrand} type="task" id={task.id} title={task.title} body={task.body} author={author} authorSlug={authorSlug} attentionActive={hasAttention(data.attention, taskBrand, "task", task.id)} comments={data.comments} reactions={data.reactions} entryReactions={[]} entryReactionsEnabled={false} previewExtra={taskContext} detailsExtra={<TaskAssigneeManager brand={taskBrand} taskId={task.id} assignments={assignments} members={data.members} canManage={memberSlug === "patrick"} />} attentionInteractive={memberSlug === "patrick"} showAuthor={false} memberSlug={memberSlug} edit={recordEditConfig({ brand: taskBrand, type: "task", id: task.id, title: task.title, action: updateTask, allowed: memberSlug === "patrick" })} />
        </article>;
      })}</ModalEntryGrid>
    </section>
  </>;
}

function CatalogueSection({ brandFilter, data, memberSlug, group, sort, query="" }: { brandFilter: BrandFilter; data: Data; memberSlug: string; group: CatalogueGroup; sort?: string; query?:string }) {
  const active = catalogueGroups.find((entry) => entry.key === group)!;
  const filteredItems=data.workspaceItems.filter(({item,author})=>item.section === "catalogue" && item.catalogueGroup === group && matchesProductSearch(query,item.title,item.flavor,group === "ideas" ? item.body : "",group === "ideas" ? author : ""));
  const canCreate=memberSlug === "patrick" || group === "ideas";
  return <CatalogueComposerProvider><div className="catalogue-navigation"><div className="b2b-section-navigation"><nav className="catalogue-submenu filter-nav" aria-label="Grupe catalog">{catalogueGroups.map((entry) => <FilterLink key={entry.key} className={entry.key === group ? "active" : undefined} href={`/?brand=${brandFilter}&view=catalogue&catalogue=${entry.key}`}>{entry.label}{entry.key === group ? ` (${filteredItems.length})` : ""}</FilterLink>)}</nav>{canCreate && <div className="b2b-add-mobile-frame"><CatalogueAddButton mobile /></div>}</div><BrandFilterNav selected={brandFilter} view="catalogue" catalogue={group} /><WorkspaceSection brandFilter={brandFilter} section="catalogue" title={active.label} displayTitle={pageTitle({ view: "catalogue", brand: brandFilter, catalogue: group })} catalogueGroup={group} showBrandFilter={false} items={sortProductList(filteredItems, normalizeProductSort(sort, brandFilter === "kaja" && group === "live"), row => ({name:row.item.title,id:row.item.id,usage:row.locationCount}))} images={data.images} comments={data.comments} reactions={data.reactions} entryReactions={data.entryReactions} attention={data.attention} memberSlug={memberSlug} /></div></CatalogueComposerProvider>;
}

function UploadsSection({ brandFilter, memberSlug, folder }: { brandFilter: BrandFilter; memberSlug: string; folder?: string }) {
  return <><BrandFilterNav selected={brandFilter} view="uploads" /><UploadLibrary brandFilter={brandFilter} memberSlug={memberSlug} folderParam={folder} /></>;
}

export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string; brand?: string; catalogue?: string; tasks?: string; taskBrand?: string; activity?: string; folder?: string; sort?: string; q?:string }> }) {
  const member = await currentMember();
  if (!member) return <main className="landing"><section className="landing-card"><Image className="logo" src="/kaja-logo.png" alt="KAJA" width={1024} height={240} priority /><p className="eyebrow">Platformă internă pentru membri</p><h1>O imagine comună asupra muncii.</h1><p>Folosește linkul personal KAJA pentru a intra în spațiul de lucru.</p>{!hasDatabase && <div className="setup">Configurarea bazei de date este în așteptare.</div>}</section></main>;
  const params = await searchParams;
  const requestedView = params.view === "updates" ? "activity" : params.view;
  const view: Section = sections.some((entry) => entry.key === requestedView) ? requestedView as Section : "activity";
  const selectedBrand: BrandFilter = brandFilters.some((entry) => entry.key === params.brand) ? params.brand as BrandFilter : "all";
  const legacyTaskBrand: BrandFilter | null = brandFilters.some((entry) => entry.key === params.taskBrand) ? params.taskBrand as BrandFilter : null;
  const brandFilter: BrandFilter = view === "tasks" && legacyTaskBrand ? legacyTaskBrand : selectedBrand;
  const group: CatalogueGroup = catalogueGroups.some((entry) => entry.key === params.catalogue) ? params.catalogue as CatalogueGroup : "live";
  const requestedTaskView: TaskView = taskViews.some((entry) => entry.key === params.tasks) ? params.tasks as TaskView : "all";
  if (view === "tasks" && requestedTaskView === "history" && member.slug !== "patrick") redirect("/?brand=all&view=tasks&tasks=all");
  const taskView: TaskView = requestedTaskView === "history" && member.slug !== "patrick" ? "all" : requestedTaskView;
  if (params.activity === "deleted" && member.slug !== "patrick") redirect("/?view=activity&brand="+brandFilter);
  const [data, globalTasks, globalActivity, deletedActivity] = await Promise.all([
    workspaceData(brandFilter),
    view === "tasks" ? taskWorkspaceData() : Promise.resolve(null),
    view === "activity" ? activityData(brandFilter) : Promise.resolve([] as ActivityData),
    view === "activity" && member.slug === "patrick" ? activityData(brandFilter,"deleted") : Promise.resolve([] as ActivityData),
  ]);
  if (!data) return <main className="landing">Este necesară baza de date.</main>;
  if (view === "tasks" && !globalTasks) return <main className="landing">Este necesară baza de date.</main>;
  const sectionItems = data.workspaceItems.filter(({ item }) => item.section === view);
  const activitySource = params.activity === "external" || params.activity === "internal" || params.activity === "deleted" ? params.activity : undefined;
  const activityFull = params.activity === "all" || activitySource !== undefined;
  const content = view === "activity" ? <><MemberDashboard slug={member.slug} brand={brandFilter} activity={globalActivity} deletedActivity={deletedActivity} full={activityFull} source={activitySource} filters={<BrandFilterNav selected={brandFilter} view="activity" activity={activitySource ?? activityFull} />} />{params.activity === "all" && <LegacyProposalDetails data={data} memberSlug={member.slug} />}</> : view === "tasks" ? <TasksSection data={globalTasks!} memberSlug={member.slug} taskView={taskView} brandFilter={brandFilter} /> : view === "catalogue" ? <CatalogueSection brandFilter={brandFilter} data={data} memberSlug={member.slug} group={group} sort={params.sort} query={params.q} /> : view === "uploads" ? <UploadsSection brandFilter={brandFilter} memberSlug={member.slug} folder={params.folder} /> : <WorkspaceSection brandFilter={brandFilter} section={view} title={sections.find((entry) => entry.key === view)!.label} displayTitle={pageTitle({ view, brand: brandFilter })} items={sectionItems} images={data.images} comments={data.comments} reactions={data.reactions} entryReactions={data.entryReactions} attention={data.attention} memberSlug={member.slug} />;
  return <><main className="workspace-shell"><WorkspaceHeader view={view} memberName={member.name} brand={brandFilter} catalogue={group} tasks={taskView} /><MobileMenu brand={brandFilter} view={view} catalogue={group} tasks={taskView} memberSlug={member.slug} /><div className="workspace-content">{content}</div></main></>;
}

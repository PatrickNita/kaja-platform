"use server";

import { del } from "@vercel/blob";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentMember } from "../lib/auth";
import { recordActivity } from "../lib/activity";
import { db, memberSeed } from "../lib/db";
import { activity, attachments, commentReactions, comments, entryReactions, members, tasks, updates, workspaceItemImages, workspaceItems } from "../lib/schema";
import { resetTelegramDigestAfterCancellation } from "../lib/telegram";
import { canManageWorkspaceItem, supportsImageGallery } from "../lib/workspace-permissions";

const title = z.string().trim().min(1).max(160);
const body = z.string().trim().min(1).max(4000);
const brand = z.enum(["kaja", "hexenwerk", "virginia"]);
const workspaceSection = z.enum(["events", "catalogue", "merch", "information"]);
const creatableWorkspaceSection = z.enum(["events", "catalogue", "information"]);
const editableWorkspaceSection = z.enum(["events", "catalogue", "merch", "information"]);
const catalogueGroup = z.enum(["live", "upcoming", "ideas"]);
const commentEntity = z.enum(["update", "task", "events", "catalogue", "merch"]);
const entryReactionEntity = z.enum(["update", "task", "events", "catalogue", "merch", "information"]);
const entryReactionType = z.enum(["heart", "like", "dislike", "poop", "question"]);
const commentBody = z.string().trim().min(1).max(1000);

const reactionEmoji = {
  heart: "❤️",
  like: "👍",
  dislike: "👎",
  poop: "💩",
  question: "❓",
} as const;

async function actor() {
  const member = await currentMember();
  if (!member || !db) throw new Error("Sesiunea de membru a expirat.");
  await db.insert(members).values(member).onConflictDoNothing();
  const [record] = await db.select().from(members).where(eq(members.slug, member.slug));
  if (!record) throw new Error("Membrul nu a putut fi încărcat.");
  return record;
}
function refresh() { revalidatePath("/"); }
function assertCanManage(member: { id: number; slug: string }, ownerId: number) {
  if (member.slug !== "patrick" && member.id !== ownerId) throw new Error("Poți modifica sau șterge doar înregistrările create de tine.");
}
type Brand = z.infer<typeof brand>;
type EntryEntity = z.infer<typeof entryReactionEntity>;

function synchronizeActivityTitle(input: { brand: Brand; entityType: EntryEntity; entityId: number; title: string }) {
  return db!.update(activity).set({
    title: input.title,
    summary: sql<string>`case
      when strpos(${activity.summary}, '„') > 0
        and strpos(reverse(${activity.summary}), '”') > 0
        and length(${activity.summary}) - strpos(reverse(${activity.summary}), '”') + 1 > strpos(${activity.summary}, '„')
      then left(${activity.summary}, strpos(${activity.summary}, '„') - 1)
        || '„' || ${input.title} || '”'
        || substring(${activity.summary} from length(${activity.summary}) - strpos(reverse(${activity.summary}), '”') + 2)
      else ${activity.summary}
    end`,
  }).where(and(
    eq(activity.brand, input.brand),
    eq(activity.entityType, input.entityType),
    eq(activity.entityId, input.entityId),
  ));
}

async function targetDetails(input: { brand: Brand; entityType: EntryEntity; entityId: number }): Promise<{ title: string; catalogueGroup?: string | null; createdBy: number } | null> {
  if (input.entityType === "update") {
    return (await db!.select({ title: updates.title, createdBy: updates.createdBy }).from(updates).where(and(eq(updates.id, input.entityId), eq(updates.brand, input.brand), isNull(updates.deletedAt))).limit(1))[0] ?? null;
  }
  if (input.entityType === "task") {
    return (await db!.select({ title: tasks.title, createdBy: tasks.createdBy }).from(tasks).where(and(eq(tasks.id, input.entityId), eq(tasks.brand, input.brand), isNull(tasks.deletedAt))).limit(1))[0] ?? null;
  }
  return (await db!.select({ title: workspaceItems.title, catalogueGroup: workspaceItems.catalogueGroup, createdBy: workspaceItems.createdBy }).from(workspaceItems).where(and(eq(workspaceItems.id, input.entityId), eq(workspaceItems.brand, input.brand), eq(workspaceItems.section, input.entityType), isNull(workspaceItems.deletedAt))).limit(1))[0] ?? null;
}

function attentionTargetName(entityType: EntryEntity, catalogue: string | null | undefined) {
  if (entityType === "update") return "propunerea";
  if (entityType === "task") return "sarcina";
  if (entityType === "events") return "evenimentul";
  if (entityType === "merch") return "produsul Merch";
  if (entityType === "information") return "informația";
  if (catalogue === "ideas") return "ideea din catalog";
  if (catalogue === "upcoming") return "produsul din În curând";
  return "produsul din Catalog activ";
}

export async function createUpdate(formData: FormData) {
  const member = await actor(); const input = z.object({ brand, title, body }).parse(Object.fromEntries(formData));
  const [record] = await db!.insert(updates).values({ ...input, createdBy: member.id, updatedBy: member.id }).returning();
  await recordActivity(member, { brand: input.brand, entityType: "update", entityId: record.id, action: "created", summary: `a adăugat propunerea „${record.title}”`, title: record.title }); refresh();
}
export async function editUpdate(formData: FormData) {
  const member = await actor(); const input = z.object({ id: z.coerce.number().int().positive(), brand, title, body }).parse(Object.fromEntries(formData));
  const [record] = await db!.select({ createdBy: updates.createdBy }).from(updates).where(and(eq(updates.id, input.id), eq(updates.brand, input.brand), isNull(updates.deletedAt)));
  if (!record) throw new Error("Înregistrarea nu mai există.");
  assertCanManage(member, record.createdBy);
  await db!.batch([
    db!.update(updates).set({ title: input.title, body: input.body, updatedBy: member.id, updatedAt: new Date() }).where(and(eq(updates.id, input.id), eq(updates.brand, input.brand), isNull(updates.deletedAt))),
    synchronizeActivityTitle({ brand: input.brand, entityType: "update", entityId: input.id, title: input.title }),
  ] as const);
  refresh();
}
export async function createTask(formData: FormData) {
  const member = await actor(); const input = z.object({ brand, title, body }).parse(Object.fromEntries(formData));
  const [record] = await db!.insert(tasks).values({ ...input, createdBy: member.id, updatedBy: member.id }).returning();
  await recordActivity(member, { brand: input.brand, entityType: "task", entityId: record.id, action: "created", summary: `a creat sarcina „${record.title}”`, title: record.title }); refresh();
}
export async function updateTask(formData: FormData) {
  const member = await actor(); const input = z.object({ id: z.coerce.number().int().positive(), brand, title, body }).parse(Object.fromEntries(formData));
  const [record] = await db!.select({ createdBy: tasks.createdBy }).from(tasks).where(and(eq(tasks.id, input.id), eq(tasks.brand, input.brand), isNull(tasks.deletedAt)));
  if (!record) throw new Error("Înregistrarea nu mai există.");
  assertCanManage(member, record.createdBy);
  await db!.batch([
    db!.update(tasks).set({ title: input.title, body: input.body, updatedBy: member.id, updatedAt: new Date() }).where(and(eq(tasks.id, input.id), eq(tasks.brand, input.brand), isNull(tasks.deletedAt))),
    synchronizeActivityTitle({ brand: input.brand, entityType: "task", entityId: input.id, title: input.title }),
  ] as const);
  refresh();
}
export async function deleteRecord(formData: FormData) {
  const member = await actor(); const input = z.object({ id: z.coerce.number().int().positive(), brand, type: z.enum(["task", "update"]), title }).parse(Object.fromEntries(formData));
  if (input.type === "task") {
    const [record] = await db!.select({ createdBy: tasks.createdBy, title: tasks.title }).from(tasks).where(and(eq(tasks.id, input.id), eq(tasks.brand, input.brand), isNull(tasks.deletedAt)));
    if (!record) return;
    assertCanManage(member, record.createdBy);
    const now = new Date();
    const [, , removedAttention] = await db!.batch([
      db!.update(tasks).set({ deletedAt: now, updatedBy: member.id, updatedAt: now }).where(and(eq(tasks.id, input.id), eq(tasks.brand, input.brand), isNull(tasks.deletedAt))),
      db!.delete(entryReactions).where(and(eq(entryReactions.brand, input.brand), eq(entryReactions.entityType, "task"), eq(entryReactions.entityId, input.id))),
      db!.delete(activity).where(and(eq(activity.brand, input.brand), eq(activity.entityType, "task"), eq(activity.entityId, input.id), eq(activity.action, "attention_requested"))).returning({ actorId: activity.actorId }),
    ] as const);
    if (removedAttention[0]) await resetTelegramDigestAfterCancellation(removedAttention[0].actorId);
    await recordActivity(member, { brand: input.brand, entityType: "task", entityId: input.id, action: "deleted", summary: `a șters sarcina „${record.title}”`, title: record.title });
  } else {
    const [record] = await db!.select({ createdBy: updates.createdBy, title: updates.title }).from(updates).where(and(eq(updates.id, input.id), eq(updates.brand, input.brand), isNull(updates.deletedAt)));
    if (!record) return;
    assertCanManage(member, record.createdBy);
    const now = new Date();
    const [, , removedAttention] = await db!.batch([
      db!.update(updates).set({ deletedAt: now, updatedBy: member.id, updatedAt: now }).where(and(eq(updates.id, input.id), eq(updates.brand, input.brand), isNull(updates.deletedAt))),
      db!.delete(entryReactions).where(and(eq(entryReactions.brand, input.brand), eq(entryReactions.entityType, "update"), eq(entryReactions.entityId, input.id))),
      db!.delete(activity).where(and(eq(activity.brand, input.brand), eq(activity.entityType, "update"), eq(activity.entityId, input.id), eq(activity.action, "attention_requested"))).returning({ actorId: activity.actorId }),
    ] as const);
    if (removedAttention[0]) await resetTelegramDigestAfterCancellation(removedAttention[0].actorId);
    await recordActivity(member, { brand: input.brand, entityType: "update", entityId: input.id, action: "deleted", summary: `a șters propunerea „${record.title}”`, title: record.title });
  }
  refresh();
}
export async function createWorkspaceItem(formData: FormData) {
  const member = await actor(); const input = z.object({ brand, section: creatableWorkspaceSection, catalogueGroup: catalogueGroup.optional(), title, body }).parse(Object.fromEntries(formData));
  if (input.section === "events" && member.slug !== "patrick") throw new Error("Doar Patrick poate adăuga evenimente.");
  if (input.section === "information" && member.slug !== "patrick") throw new Error("Doar Patrick poate adăuga informații.");
  if (input.section === "catalogue" && input.catalogueGroup !== "ideas" && member.slug !== "patrick") throw new Error("Doar Patrick poate adăuga produse în Catalog activ sau În curând.");
  const [record] = await db!.insert(workspaceItems).values({ ...input, catalogueGroup: input.section === "catalogue" ? input.catalogueGroup ?? "live" : null, createdBy: member.id, updatedBy: member.id }).returning();
  await recordActivity(member, { brand: input.brand, entityType: input.section, entityId: record.id, action: "created", summary: input.section === "information" ? `a creat informația „${record.title}”` : `a creat o înregistrare „${record.title}”`, title: record.title, catalogueGroup: record.catalogueGroup }); refresh();
  return { id: record.id };
}
export async function createWorkspaceItemForm(formData: FormData) {
  await createWorkspaceItem(formData);
}
export async function updateWorkspaceItem(formData: FormData) {
  const member = await actor(); const input = z.object({ id: z.coerce.number().int().positive(), brand, section: editableWorkspaceSection, title, body }).parse(Object.fromEntries(formData));
  const [item] = await db!.select({ catalogueGroup: workspaceItems.catalogueGroup, createdBy: workspaceItems.createdBy }).from(workspaceItems).where(and(eq(workspaceItems.id, input.id), eq(workspaceItems.brand, input.brand), eq(workspaceItems.section, input.section), isNull(workspaceItems.deletedAt)));
  if (!item) throw new Error("Înregistrarea nu mai există.");
  if (!canManageWorkspaceItem(member, { ...item, section: input.section })) throw new Error("Nu ai permisiunea să modifici această înregistrare.");
  await db!.batch([
    db!.update(workspaceItems).set({ title: input.title, body: input.body, updatedBy: member.id, updatedAt: new Date() }).where(and(eq(workspaceItems.id, input.id), eq(workspaceItems.brand, input.brand), eq(workspaceItems.section, input.section), isNull(workspaceItems.deletedAt))),
    synchronizeActivityTitle({ brand: input.brand, entityType: input.section, entityId: input.id, title: input.title }),
  ] as const);
  refresh();
}
export async function deleteWorkspaceItem(formData: FormData) {
  const member = await actor(); const input = z.object({ id: z.coerce.number().int().positive(), brand, section: workspaceSection, title }).parse(Object.fromEntries(formData));
  const [item] = await db!.select().from(workspaceItems).where(and(eq(workspaceItems.id, input.id), eq(workspaceItems.brand, input.brand), eq(workspaceItems.section, input.section), isNull(workspaceItems.deletedAt)));
  if (!item) return;
  if (!canManageWorkspaceItem(member, item)) throw new Error("Nu ai permisiunea să ștergi această înregistrare.");
  const itemImages = await db!.select().from(workspaceItemImages).where(and(eq(workspaceItemImages.itemId, item.id), eq(workspaceItemImages.brand, input.brand), isNull(workspaceItemImages.deletedAt)));
  const imageUrls = new Set(itemImages.map((image) => image.url));
  if (item.merchImageUrl) imageUrls.add(item.merchImageUrl);
  for (const imageUrl of imageUrls) await del(imageUrl);
  if (itemImages.length) await db!.update(workspaceItemImages).set({ deletedAt: new Date() }).where(and(eq(workspaceItemImages.itemId, item.id), eq(workspaceItemImages.brand, input.brand), isNull(workspaceItemImages.deletedAt)));
  const now = new Date();
  const [, , removedAttention] = await db!.batch([
    db!.update(workspaceItems).set({ deletedAt: now, updatedBy: member.id, updatedAt: now }).where(and(eq(workspaceItems.id, item.id), eq(workspaceItems.brand, input.brand), isNull(workspaceItems.deletedAt))),
    db!.delete(entryReactions).where(and(eq(entryReactions.brand, input.brand), eq(entryReactions.entityType, item.section), eq(entryReactions.entityId, item.id))),
    db!.delete(activity).where(and(eq(activity.brand, input.brand), eq(activity.entityType, item.section), eq(activity.entityId, item.id), eq(activity.action, "attention_requested"))).returning({ actorId: activity.actorId }),
  ] as const);
  if (removedAttention[0]) await resetTelegramDigestAfterCancellation(removedAttention[0].actorId);
  await recordActivity(member, { brand: input.brand, entityType: input.section, entityId: item.id, action: "deleted", summary: `a șters ${input.section === "information" ? "informația" : input.section === "events" ? "evenimentul" : input.section === "merch" ? "produsul merch" : item.catalogueGroup === "ideas" ? "ideea" : item.catalogueGroup === "upcoming" ? "produsul din În curând" : "produsul din Catalog activ"} „${item.title}”`, title: item.title, catalogueGroup: item.catalogueGroup }); refresh();
}
export async function deleteWorkspaceItemImage(formData: FormData) {
  const member = await actor();
  const input = z.object({ id: z.coerce.number().int().positive(), itemId: z.coerce.number().int().positive(), brand }).parse(Object.fromEntries(formData));
  const [item] = await db!.select().from(workspaceItems).where(and(eq(workspaceItems.id, input.itemId), eq(workspaceItems.brand, input.brand), isNull(workspaceItems.deletedAt)));
  if (!item || !supportsImageGallery(item)) throw new Error("Galeria nu este disponibilă pentru această înregistrare.");
  if (!canManageWorkspaceItem(member, item)) throw new Error("Nu ai permisiunea să modifici această galerie.");
  const images = await db!.select().from(workspaceItemImages).where(and(eq(workspaceItemImages.itemId, item.id), eq(workspaceItemImages.brand, input.brand), isNull(workspaceItemImages.deletedAt)));
  const image = images.find((entry) => entry.id === input.id);
  if (!image) return;
  if (item.section === "merch" && images.length <= 1) throw new Error("Un produs Merch trebuie să păstreze cel puțin o imagine.");
  await del(image.url);
  await db!.update(workspaceItemImages).set({ deletedAt: new Date() }).where(eq(workspaceItemImages.id, image.id));
  if (item.merchImageUrl === image.url) await db!.update(workspaceItems).set({ merchImageUrl: null, merchImagePathname: null, updatedBy: member.id, updatedAt: new Date() }).where(eq(workspaceItems.id, item.id));
  await recordActivity(member, { brand: input.brand, entityType: item.section as "events" | "catalogue" | "merch", entityId: item.id, action: "image_deleted", summary: `a șters o imagine din „${item.title}”`, title: item.title, catalogueGroup: item.catalogueGroup });
  refresh();
}
export async function deleteAttachment(formData: FormData) {
  const member = await actor(); const input = z.object({ id: z.coerce.number().int().positive(), brand, filename: z.string().min(1).max(255) }).parse(Object.fromEntries(formData));
  if (member.slug !== "patrick") throw new Error("Doar Patrick poate șterge PDF-uri.");
  const [attachment] = await db!.select().from(attachments).where(and(eq(attachments.id, input.id), eq(attachments.brand, input.brand), isNull(attachments.deletedAt)));
  if (!attachment) return;
  await del(attachment.url); await db!.update(attachments).set({ deletedAt: new Date() }).where(eq(attachments.id, attachment.id));
  await recordActivity(member, { brand: input.brand, entityType: "attachment", entityId: attachment.id, action: "deleted", summary: `a șters PDF-ul „${attachment.filename}”`, title: attachment.filename }); refresh();
}
export async function createComment(formData: FormData) {
  const member = await actor();
  const input = z.object({ brand, entityType: commentEntity, entityId: z.coerce.number().int().positive(), body: commentBody }).parse(Object.fromEntries(formData));
  const target = await targetDetails(input);
  if (!target) throw new Error("Această înregistrare nu mai este disponibilă.");
  const [comment] = await db!.insert(comments).values({ brand: input.brand, entityType: input.entityType, entityId: input.entityId, authorId: member.id, body: input.body }).returning();
  await recordActivity(member, { brand: input.brand, entityType: input.entityType, entityId: input.entityId, action: "commented", summary: "a adăugat un comentariu", title: target.title, catalogueGroup: target.catalogueGroup });
  refresh();
}
export async function deleteComment(formData: FormData) {
  const member = await actor();
  const input = z.object({ id: z.coerce.number().int().positive(), brand, entityType: commentEntity, entityId: z.coerce.number().int().positive() }).parse(Object.fromEntries(formData));
  const [comment] = await db!.select().from(comments).where(and(eq(comments.id, input.id), eq(comments.brand, input.brand), eq(comments.authorId, member.id), isNull(comments.deletedAt)));
  if (!comment) return;
  const target = await targetDetails(input);
  if (!target) return;
  await db!.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, comment.id));
  await recordActivity(member, { brand: input.brand, entityType: input.entityType, entityId: input.entityId, action: "comment_deleted", summary: `a șters un comentariu la „${target.title}”`, title: target.title, catalogueGroup: target.catalogueGroup });
  refresh();
}
export async function toggleCommentHeart(formData: FormData) {
  const member = await actor();
  const input = z.object({ brand, commentId: z.coerce.number().int().positive() }).parse(Object.fromEntries(formData));
  const [comment] = await db!.select({ id: comments.id }).from(comments).where(and(eq(comments.id, input.commentId), eq(comments.brand, input.brand), isNull(comments.deletedAt)));
  if (!comment) return;
  const [reaction] = await db!.select({ id: commentReactions.id }).from(commentReactions).where(and(eq(commentReactions.commentId, comment.id), eq(commentReactions.memberId, member.id)));
  if (reaction) await db!.delete(commentReactions).where(eq(commentReactions.id, reaction.id));
  else await db!.insert(commentReactions).values({ brand: input.brand, commentId: comment.id, memberId: member.id });
  refresh();
}

export async function toggleEntryReaction(formData: FormData) {
  const member = await actor();
  const input = z.object({ brand, entityType: entryReactionEntity, entityId: z.coerce.number().int().positive(), reactionType: entryReactionType }).parse(Object.fromEntries(formData));
  const target = await targetDetails(input);
  if (!target) throw new Error("Această înregistrare nu mai este disponibilă.");

  const [existing] = await db!.select({ id: entryReactions.id }).from(entryReactions).where(and(
    eq(entryReactions.brand, input.brand),
    eq(entryReactions.entityType, input.entityType),
    eq(entryReactions.entityId, input.entityId),
    eq(entryReactions.reactionType, input.reactionType),
    eq(entryReactions.memberId, member.id),
  ));
  if (existing) {
    await db!.delete(entryReactions).where(eq(entryReactions.id, existing.id));
    refresh();
    return;
  }

  const inserted = await db!.insert(entryReactions).values({
    brand: input.brand,
    entityType: input.entityType,
    entityId: input.entityId,
    reactionType: input.reactionType,
    memberId: member.id,
  }).onConflictDoNothing().returning({ id: entryReactions.id });
  if (inserted.length > 0) {
    const emoji = reactionEmoji[input.reactionType];
    await recordActivity(member, {
      brand: input.brand,
      entityType: input.entityType,
      entityId: input.entityId,
      action: "reacted",
      summary: `a reacționat cu ${emoji} la „${target.title}”`,
      title: target.title,
      catalogueGroup: target.catalogueGroup,
      reactionType: input.reactionType,
    });
  }
  refresh();
}

export async function toggleEntryAttention(formData: FormData) {
  const member = await actor();
  const input = z.object({
    brand,
    entityType: entryReactionEntity,
    entityId: z.coerce.number().int().positive(),
  }).parse(Object.fromEntries(formData));
  const target = await targetDetails(input);
  if (!target) throw new Error("Această înregistrare nu mai este disponibilă.");
  if (target.createdBy !== member.id) throw new Error("Doar autorul poate solicita atenție pentru această înregistrare.");

  const [existing] = await db!.select({ id: activity.id }).from(activity).where(and(
    eq(activity.brand, input.brand),
    eq(activity.entityType, input.entityType),
    eq(activity.entityId, input.entityId),
    eq(activity.actorId, member.id),
    eq(activity.action, "attention_requested"),
  )).limit(1);

  if (existing) {
    const [removed] = await db!.delete(activity).where(and(
      eq(activity.id, existing.id),
      eq(activity.actorId, member.id),
      eq(activity.action, "attention_requested"),
    )).returning({ id: activity.id });
    if (removed) await resetTelegramDigestAfterCancellation(member.id);
    refresh();
    return;
  }

  const noun = attentionTargetName(input.entityType, target.catalogueGroup);
  await recordActivity(member, {
    brand: input.brand,
    entityType: input.entityType,
    entityId: input.entityId,
    action: "attention_requested",
    summary: `cere mai multă atenție la ${noun} „${target.title}”`,
    title: target.title,
    catalogueGroup: target.catalogueGroup,
  });
  refresh();
}

export async function activityData(filter: "all" | Brand) {
  const session = await currentMember();
  if (!db || !session) return [];
  const selected = z.enum(["all", "kaja", "hexenwerk", "virginia"]).parse(filter);
  const base = db.select({ event: activity, actor: members.name }).from(activity).innerJoin(members, eq(activity.actorId, members.id));
  const rows = selected === "all"
    ? await base.orderBy(desc(activity.createdAt), desc(activity.id)).limit(200)
    : await base.where(eq(activity.brand, selected)).orderBy(desc(activity.createdAt), desc(activity.id)).limit(200);

  const updateIds = rows.filter(({ event }) => event.entityType === "update").map(({ event }) => event.entityId);
  const taskIds = rows.filter(({ event }) => event.entityType === "task").map(({ event }) => event.entityId);
  const attachmentIds = rows.filter(({ event }) => event.entityType === "attachment").map(({ event }) => event.entityId);
  const itemIds = rows.filter(({ event }) => !["update", "task", "attachment"].includes(event.entityType)).map(({ event }) => event.entityId);

  const [liveUpdates, liveTasks, liveAttachments, liveItems] = await Promise.all([
    updateIds.length ? db.select({ id: updates.id, brand: updates.brand }).from(updates).where(and(inArray(updates.id, updateIds), isNull(updates.deletedAt))) : [],
    taskIds.length ? db.select({ id: tasks.id, brand: tasks.brand }).from(tasks).where(and(inArray(tasks.id, taskIds), isNull(tasks.deletedAt))) : [],
    attachmentIds.length ? db.select({ id: attachments.id, brand: attachments.brand }).from(attachments).where(and(inArray(attachments.id, attachmentIds), isNull(attachments.deletedAt))) : [],
    itemIds.length ? db.select({ id: workspaceItems.id, brand: workspaceItems.brand, section: workspaceItems.section }).from(workspaceItems).where(and(inArray(workspaceItems.id, itemIds), isNull(workspaceItems.deletedAt))) : [],
  ]);
  const liveTargets = new Set<string>([
    ...liveUpdates.map((entry) => `${entry.brand}:update:${entry.id}`),
    ...liveTasks.map((entry) => `${entry.brand}:task:${entry.id}`),
    ...liveAttachments.map((entry) => `${entry.brand}:attachment:${entry.id}`),
    ...liveItems.map((entry) => `${entry.brand}:${entry.section}:${entry.id}`),
  ]);
  return rows.map((row) => ({
    ...row,
    targetExists: liveTargets.has(`${row.event.brand}:${row.event.entityType}:${row.event.entityId}`),
  }));
}

export async function workspaceData(brandName: "kaja" | "hexenwerk" | "virginia") {
  if (!db) return null;
  for (const member of memberSeed) await db.insert(members).values(member).onConflictDoNothing();
  const [allUpdates, allTasks, allWorkspaceItems, allImages, allAttachments, allComments, allReactions, allEntryReactions, allAttention] = await Promise.all([
    db.select({ update: updates, author: members.name, authorSlug: members.slug }).from(updates).innerJoin(members, eq(updates.createdBy, members.id)).where(and(eq(updates.brand, brandName), isNull(updates.deletedAt))).orderBy(desc(updates.updatedAt)),
    db.select({ task: tasks, author: members.name, authorSlug: members.slug }).from(tasks).innerJoin(members, eq(tasks.createdBy, members.id)).where(and(eq(tasks.brand, brandName), isNull(tasks.deletedAt))).orderBy(desc(tasks.updatedAt)),
    db.select({ item: workspaceItems, author: members.name, authorSlug: members.slug }).from(workspaceItems).innerJoin(members, eq(workspaceItems.createdBy, members.id)).where(and(eq(workspaceItems.brand, brandName), isNull(workspaceItems.deletedAt))).orderBy(desc(workspaceItems.updatedAt)),
    db.select().from(workspaceItemImages).where(and(eq(workspaceItemImages.brand, brandName), isNull(workspaceItemImages.deletedAt))).orderBy(workspaceItemImages.itemId, workspaceItemImages.position, workspaceItemImages.createdAt),
    db.select({ attachment: attachments, author: members.name, authorSlug: members.slug }).from(attachments).innerJoin(members, eq(attachments.uploadedBy, members.id)).where(and(eq(attachments.brand, brandName), isNull(attachments.deletedAt))).orderBy(desc(attachments.createdAt)),
    db.select({ comment: comments, author: members.name, authorSlug: members.slug }).from(comments).innerJoin(members, eq(comments.authorId, members.id)).where(and(eq(comments.brand, brandName), isNull(comments.deletedAt))).orderBy(comments.createdAt),
    db.select({ reaction: commentReactions, memberName: members.name, memberSlug: members.slug }).from(commentReactions).innerJoin(members, eq(commentReactions.memberId, members.id)).where(eq(commentReactions.brand, brandName)).orderBy(commentReactions.createdAt),
    db.select({ reaction: entryReactions, memberName: members.name, memberSlug: members.slug }).from(entryReactions).innerJoin(members, eq(entryReactions.memberId, members.id)).where(eq(entryReactions.brand, brandName)).orderBy(entryReactions.createdAt),
    db.select({ event: activity }).from(activity).where(and(eq(activity.brand, brandName), eq(activity.action, "attention_requested"))).orderBy(activity.createdAt, activity.id),
  ]);
  return { updates: allUpdates, tasks: allTasks, workspaceItems: allWorkspaceItems, images: allImages, attachments: allAttachments, comments: allComments, reactions: allReactions, entryReactions: allEntryReactions, attention: allAttention };
}

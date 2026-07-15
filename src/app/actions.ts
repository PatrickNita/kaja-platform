"use server";

import { del } from "@vercel/blob";
import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentMember } from "../lib/auth";
import { db, memberSeed } from "../lib/db";
import { activity, attachments, comments, members, tasks, updates, workspaceItems } from "../lib/schema";

const title = z.string().trim().min(1).max(160);
const body = z.string().trim().min(1).max(4000);
const brand = z.enum(["kaja", "hexenwerk", "virginia"]);
const workspaceSection = z.enum(["events", "catalogue", "merch"]);
const creatableWorkspaceSection = z.enum(["events", "catalogue"]);
const catalogueGroup = z.enum(["live", "upcoming", "ideas"]);
const commentEntity = z.enum(["update", "task", "events", "catalogue", "merch"]);
const commentBody = z.string().trim().min(1).max(1000);

async function actor() {
  const member = await currentMember();
  if (!member || !db) throw new Error("Sesiunea de membru a expirat.");
  await db.insert(members).values(member).onConflictDoNothing();
  const [record] = await db.select().from(members).where(eq(members.slug, member.slug));
  if (!record) throw new Error("Membrul nu a putut fi încărcat.");
  return record;
}
function refresh() { revalidatePath("/"); }

export async function createUpdate(formData: FormData) {
  const member = await actor(); const input = z.object({ brand, title, body }).parse(Object.fromEntries(formData));
  const [record] = await db!.insert(updates).values({ ...input, createdBy: member.id, updatedBy: member.id }).returning();
  await db!.insert(activity).values({ brand: input.brand, actorId: member.id, entityType: "update", entityId: record.id, action: "created", summary: `a adăugat actualizarea „${record.title}”` }); refresh();
}
export async function editUpdate(formData: FormData) {
  const member = await actor(); const input = z.object({ id: z.coerce.number().int().positive(), brand, title, body }).parse(Object.fromEntries(formData));
  await db!.update(updates).set({ title: input.title, body: input.body, updatedBy: member.id, updatedAt: new Date() }).where(and(eq(updates.id, input.id), eq(updates.brand, input.brand), isNull(updates.deletedAt)));
  await db!.insert(activity).values({ brand: input.brand, actorId: member.id, entityType: "update", entityId: input.id, action: "edited", summary: `a editat actualizarea „${input.title}”` }); refresh();
}
export async function createTask(formData: FormData) {
  const member = await actor(); const input = z.object({ brand, title }).parse(Object.fromEntries(formData));
  const [record] = await db!.insert(tasks).values({ ...input, createdBy: member.id, updatedBy: member.id }).returning();
  await db!.insert(activity).values({ brand: input.brand, actorId: member.id, entityType: "task", entityId: record.id, action: "created", summary: `a creat sarcina „${record.title}”` }); refresh();
}
export async function updateTask(formData: FormData) {
  const member = await actor(); const input = z.object({ id: z.coerce.number().int().positive(), brand, title }).parse(Object.fromEntries(formData));
  await db!.update(tasks).set({ title: input.title, updatedBy: member.id, updatedAt: new Date() }).where(and(eq(tasks.id, input.id), eq(tasks.brand, input.brand), isNull(tasks.deletedAt)));
  await db!.insert(activity).values({ brand: input.brand, actorId: member.id, entityType: "task", entityId: input.id, action: "updated", summary: `a actualizat sarcina „${input.title}”` }); refresh();
}
export async function deleteRecord(formData: FormData) {
  const member = await actor(); const input = z.object({ id: z.coerce.number().int().positive(), brand, type: z.enum(["task", "update"]), title }).parse(Object.fromEntries(formData));
  if (input.type === "task") await db!.update(tasks).set({ deletedAt: new Date(), updatedBy: member.id, updatedAt: new Date() }).where(and(eq(tasks.id, input.id), eq(tasks.brand, input.brand)));
  else await db!.update(updates).set({ deletedAt: new Date(), updatedBy: member.id, updatedAt: new Date() }).where(and(eq(updates.id, input.id), eq(updates.brand, input.brand)));
  await db!.insert(activity).values({ brand: input.brand, actorId: member.id, entityType: input.type, entityId: input.id, action: "deleted", summary: `a șters o înregistrare` }); refresh();
}
export async function createWorkspaceItem(formData: FormData) {
  const member = await actor(); const input = z.object({ brand, section: creatableWorkspaceSection, catalogueGroup: catalogueGroup.optional(), title, body }).parse(Object.fromEntries(formData));
  if (input.section === "catalogue" && input.catalogueGroup !== "ideas" && member.slug !== "patrick") throw new Error("Doar Patrick poate adăuga produse în Catalog activ sau În curând.");
  const [record] = await db!.insert(workspaceItems).values({ ...input, catalogueGroup: input.section === "catalogue" ? input.catalogueGroup ?? "live" : null, createdBy: member.id, updatedBy: member.id }).returning();
  await db!.insert(activity).values({ brand: input.brand, actorId: member.id, entityType: input.section, entityId: record.id, action: "created", summary: `a creat o înregistrare „${record.title}”` }); refresh();
}
export async function updateWorkspaceItem(formData: FormData) {
  const member = await actor(); const input = z.object({ id: z.coerce.number().int().positive(), brand, section: creatableWorkspaceSection, title, body }).parse(Object.fromEntries(formData));
  await db!.update(workspaceItems).set({ title: input.title, body: input.body, updatedBy: member.id, updatedAt: new Date() }).where(and(eq(workspaceItems.id, input.id), eq(workspaceItems.brand, input.brand), eq(workspaceItems.section, input.section), isNull(workspaceItems.deletedAt)));
  await db!.insert(activity).values({ brand: input.brand, actorId: member.id, entityType: input.section, entityId: input.id, action: "updated", summary: `a actualizat o înregistrare „${input.title}”` }); refresh();
}
export async function deleteWorkspaceItem(formData: FormData) {
  const member = await actor(); const input = z.object({ id: z.coerce.number().int().positive(), brand, section: workspaceSection, title }).parse(Object.fromEntries(formData));
  const [item] = await db!.select().from(workspaceItems).where(and(eq(workspaceItems.id, input.id), eq(workspaceItems.brand, input.brand), eq(workspaceItems.section, input.section), isNull(workspaceItems.deletedAt)));
  if (!item) return;
  if (item.merchImageUrl) await del(item.merchImageUrl);
  await db!.update(workspaceItems).set({ deletedAt: new Date(), updatedBy: member.id, updatedAt: new Date() }).where(eq(workspaceItems.id, item.id));
  await db!.insert(activity).values({ brand: input.brand, actorId: member.id, entityType: input.section, entityId: item.id, action: "deleted", summary: `a șters o înregistrare` }); refresh();
}
export async function deleteAttachment(formData: FormData) {
  const member = await actor(); const input = z.object({ id: z.coerce.number().int().positive(), brand, filename: z.string().min(1).max(255) }).parse(Object.fromEntries(formData));
  const [attachment] = await db!.select().from(attachments).where(and(eq(attachments.id, input.id), eq(attachments.brand, input.brand), isNull(attachments.deletedAt)));
  if (!attachment) return;
  await del(attachment.url); await db!.update(attachments).set({ deletedAt: new Date() }).where(eq(attachments.id, attachment.id));
  await db!.insert(activity).values({ brand: input.brand, actorId: member.id, entityType: "attachment", entityId: attachment.id, action: "deleted", summary: `deleted PDF “${attachment.filename}”` }); refresh();
}
export async function createComment(formData: FormData) {
  const member = await actor();
  const input = z.object({ brand, entityType: commentEntity, entityId: z.coerce.number().int().positive(), body: commentBody }).parse(Object.fromEntries(formData));
  let exists = false;
  if (input.entityType === "update") exists = Boolean((await db!.select({ id: updates.id }).from(updates).where(and(eq(updates.id, input.entityId), eq(updates.brand, input.brand), isNull(updates.deletedAt))).limit(1))[0]);
  else if (input.entityType === "task") exists = Boolean((await db!.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, input.entityId), eq(tasks.brand, input.brand), isNull(tasks.deletedAt))).limit(1))[0]);
  else exists = Boolean((await db!.select({ id: workspaceItems.id }).from(workspaceItems).where(and(eq(workspaceItems.id, input.entityId), eq(workspaceItems.brand, input.brand), eq(workspaceItems.section, input.entityType), isNull(workspaceItems.deletedAt))).limit(1))[0]);
  if (!exists) throw new Error("Această înregistrare nu mai este disponibilă.");
  const [comment] = await db!.insert(comments).values({ brand: input.brand, entityType: input.entityType, entityId: input.entityId, authorId: member.id, body: input.body }).returning();
  await db!.insert(activity).values({ brand: input.brand, actorId: member.id, entityType: input.entityType, entityId: input.entityId, action: "commented", summary: "a adăugat un comentariu" });
  refresh();
}
export async function deleteComment(formData: FormData) {
  const member = await actor();
  const input = z.object({ id: z.coerce.number().int().positive(), brand, entityType: commentEntity, entityId: z.coerce.number().int().positive() }).parse(Object.fromEntries(formData));
  const [comment] = await db!.select().from(comments).where(and(eq(comments.id, input.id), eq(comments.brand, input.brand), eq(comments.authorId, member.id), isNull(comments.deletedAt)));
  if (!comment) return;
  await db!.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, comment.id));
  await db!.insert(activity).values({ brand: input.brand, actorId: member.id, entityType: input.entityType, entityId: input.entityId, action: "comment_deleted", summary: "a șters un comentariu" });
  refresh();
}
export async function workspaceData(brandName: "kaja" | "hexenwerk" | "virginia") {
  if (!db) return null;
  for (const member of memberSeed) await db.insert(members).values(member).onConflictDoNothing();
  const [allUpdates, allTasks, allWorkspaceItems, allAttachments, allActivity, allComments] = await Promise.all([
    db.select({ update: updates, author: members.name }).from(updates).innerJoin(members, eq(updates.createdBy, members.id)).where(and(eq(updates.brand, brandName), isNull(updates.deletedAt))).orderBy(desc(updates.updatedAt)),
    db.select({ task: tasks, author: members.name }).from(tasks).innerJoin(members, eq(tasks.createdBy, members.id)).where(and(eq(tasks.brand, brandName), isNull(tasks.deletedAt))).orderBy(desc(tasks.updatedAt)),
    db.select({ item: workspaceItems, author: members.name }).from(workspaceItems).innerJoin(members, eq(workspaceItems.createdBy, members.id)).where(and(eq(workspaceItems.brand, brandName), isNull(workspaceItems.deletedAt))).orderBy(desc(workspaceItems.updatedAt)),
    db.select({ attachment: attachments, author: members.name }).from(attachments).innerJoin(members, eq(attachments.uploadedBy, members.id)).where(and(eq(attachments.brand, brandName), isNull(attachments.deletedAt))).orderBy(desc(attachments.createdAt)),
    db.select({ event: activity, actor: members.name }).from(activity).innerJoin(members, eq(activity.actorId, members.id)).where(eq(activity.brand, brandName)).orderBy(desc(activity.createdAt)).limit(100),
    db.select({ comment: comments, author: members.name, authorSlug: members.slug }).from(comments).innerJoin(members, eq(comments.authorId, members.id)).where(and(eq(comments.brand, brandName), isNull(comments.deletedAt))).orderBy(comments.createdAt),
  ]);
  return { updates: allUpdates, tasks: allTasks, workspaceItems: allWorkspaceItems, attachments: allAttachments, activity: allActivity, comments: allComments };
}

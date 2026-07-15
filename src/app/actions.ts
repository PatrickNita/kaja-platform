"use server";

import { del } from "@vercel/blob";
import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentMember } from "../lib/auth";
import { db, memberSeed } from "../lib/db";
import { activity, attachments, members, tasks, updates, workspaceItems } from "../lib/schema";

const title = z.string().trim().min(1).max(160);
const body = z.string().trim().min(1).max(4000);
const brand = z.enum(["kaja", "hexenwerk"]);
const workspaceSection = z.enum(["events", "flavors", "catalogue", "merch"]);
const creatableWorkspaceSection = z.enum(["events", "flavors", "catalogue"]);
const catalogueGroup = z.enum(["live", "upcoming", "ideas"]);

async function actor() {
  const member = await currentMember();
  if (!member || !db) throw new Error("Your member session has expired.");
  await db.insert(members).values(member).onConflictDoNothing();
  const [record] = await db.select().from(members).where(eq(members.slug, member.slug));
  if (!record) throw new Error("Member could not be loaded.");
  return record;
}
function refresh() { revalidatePath("/"); }

export async function createUpdate(formData: FormData) {
  const member = await actor(); const input = z.object({ brand, title, body }).parse(Object.fromEntries(formData));
  const [record] = await db!.insert(updates).values({ ...input, createdBy: member.id, updatedBy: member.id }).returning();
  await db!.insert(activity).values({ brand: input.brand, actorId: member.id, entityType: "update", entityId: record.id, action: "created", summary: `added update “${record.title}”` }); refresh();
}
export async function editUpdate(formData: FormData) {
  const member = await actor(); const input = z.object({ id: z.coerce.number().int().positive(), brand, title, body }).parse(Object.fromEntries(formData));
  await db!.update(updates).set({ title: input.title, body: input.body, updatedBy: member.id, updatedAt: new Date() }).where(and(eq(updates.id, input.id), eq(updates.brand, input.brand), isNull(updates.deletedAt)));
  await db!.insert(activity).values({ brand: input.brand, actorId: member.id, entityType: "update", entityId: input.id, action: "edited", summary: `edited update “${input.title}”` }); refresh();
}
export async function createTask(formData: FormData) {
  const member = await actor(); const input = z.object({ brand, title }).parse(Object.fromEntries(formData));
  const [record] = await db!.insert(tasks).values({ ...input, createdBy: member.id, updatedBy: member.id }).returning();
  await db!.insert(activity).values({ brand: input.brand, actorId: member.id, entityType: "task", entityId: record.id, action: "created", summary: `created task “${record.title}”` }); refresh();
}
export async function updateTask(formData: FormData) {
  const member = await actor(); const input = z.object({ id: z.coerce.number().int().positive(), brand, title }).parse(Object.fromEntries(formData));
  await db!.update(tasks).set({ title: input.title, updatedBy: member.id, updatedAt: new Date() }).where(and(eq(tasks.id, input.id), eq(tasks.brand, input.brand), isNull(tasks.deletedAt)));
  await db!.insert(activity).values({ brand: input.brand, actorId: member.id, entityType: "task", entityId: input.id, action: "updated", summary: `updated task “${input.title}”` }); refresh();
}
export async function deleteRecord(formData: FormData) {
  const member = await actor(); const input = z.object({ id: z.coerce.number().int().positive(), brand, type: z.enum(["task", "update"]), title }).parse(Object.fromEntries(formData));
  if (input.type === "task") await db!.update(tasks).set({ deletedAt: new Date(), updatedBy: member.id, updatedAt: new Date() }).where(and(eq(tasks.id, input.id), eq(tasks.brand, input.brand)));
  else await db!.update(updates).set({ deletedAt: new Date(), updatedBy: member.id, updatedAt: new Date() }).where(and(eq(updates.id, input.id), eq(updates.brand, input.brand)));
  await db!.insert(activity).values({ brand: input.brand, actorId: member.id, entityType: input.type, entityId: input.id, action: "deleted", summary: `deleted ${input.type} “${input.title}”` }); refresh();
}
export async function createWorkspaceItem(formData: FormData) {
  const member = await actor(); const input = z.object({ brand, section: creatableWorkspaceSection, catalogueGroup: catalogueGroup.optional(), title, body }).parse(Object.fromEntries(formData));
  const [record] = await db!.insert(workspaceItems).values({ ...input, catalogueGroup: input.section === "catalogue" ? input.catalogueGroup ?? "live" : null, createdBy: member.id, updatedBy: member.id }).returning();
  await db!.insert(activity).values({ brand: input.brand, actorId: member.id, entityType: input.section, entityId: record.id, action: "created", summary: `created ${input.section.slice(0, -1)} “${record.title}”` }); refresh();
}
export async function updateWorkspaceItem(formData: FormData) {
  const member = await actor(); const input = z.object({ id: z.coerce.number().int().positive(), brand, section: creatableWorkspaceSection, title, body }).parse(Object.fromEntries(formData));
  await db!.update(workspaceItems).set({ title: input.title, body: input.body, updatedBy: member.id, updatedAt: new Date() }).where(and(eq(workspaceItems.id, input.id), eq(workspaceItems.brand, input.brand), eq(workspaceItems.section, input.section), isNull(workspaceItems.deletedAt)));
  await db!.insert(activity).values({ brand: input.brand, actorId: member.id, entityType: input.section, entityId: input.id, action: "updated", summary: `updated ${input.section.slice(0, -1)} “${input.title}”` }); refresh();
}
export async function deleteWorkspaceItem(formData: FormData) {
  const member = await actor(); const input = z.object({ id: z.coerce.number().int().positive(), brand, section: workspaceSection, title }).parse(Object.fromEntries(formData));
  const [item] = await db!.select().from(workspaceItems).where(and(eq(workspaceItems.id, input.id), eq(workspaceItems.brand, input.brand), eq(workspaceItems.section, input.section), isNull(workspaceItems.deletedAt)));
  if (!item) return;
  if (item.merchImageUrl) await del(item.merchImageUrl);
  await db!.update(workspaceItems).set({ deletedAt: new Date(), updatedBy: member.id, updatedAt: new Date() }).where(eq(workspaceItems.id, item.id));
  await db!.insert(activity).values({ brand: input.brand, actorId: member.id, entityType: input.section, entityId: item.id, action: "deleted", summary: `deleted ${input.section.slice(0, -1)} “${input.title}”` }); refresh();
}
export async function deleteAttachment(formData: FormData) {
  const member = await actor(); const input = z.object({ id: z.coerce.number().int().positive(), brand, filename: z.string().min(1).max(255) }).parse(Object.fromEntries(formData));
  const [attachment] = await db!.select().from(attachments).where(and(eq(attachments.id, input.id), eq(attachments.brand, input.brand), isNull(attachments.deletedAt)));
  if (!attachment) return;
  await del(attachment.url); await db!.update(attachments).set({ deletedAt: new Date() }).where(eq(attachments.id, attachment.id));
  await db!.insert(activity).values({ brand: input.brand, actorId: member.id, entityType: "attachment", entityId: attachment.id, action: "deleted", summary: `deleted PDF “${attachment.filename}”` }); refresh();
}
export async function workspaceData(brandName: "kaja" | "hexenwerk") {
  if (!db) return null;
  for (const member of memberSeed) await db.insert(members).values(member).onConflictDoNothing();
  const [allUpdates, allTasks, allWorkspaceItems, allAttachments, allActivity] = await Promise.all([
    db.select({ update: updates, author: members.name }).from(updates).innerJoin(members, eq(updates.createdBy, members.id)).where(and(eq(updates.brand, brandName), isNull(updates.deletedAt))).orderBy(desc(updates.updatedAt)),
    db.select({ task: tasks, author: members.name }).from(tasks).innerJoin(members, eq(tasks.createdBy, members.id)).where(and(eq(tasks.brand, brandName), isNull(tasks.deletedAt))).orderBy(desc(tasks.updatedAt)),
    db.select({ item: workspaceItems, author: members.name }).from(workspaceItems).innerJoin(members, eq(workspaceItems.createdBy, members.id)).where(and(eq(workspaceItems.brand, brandName), isNull(workspaceItems.deletedAt))).orderBy(desc(workspaceItems.updatedAt)),
    db.select({ attachment: attachments, author: members.name }).from(attachments).innerJoin(members, eq(attachments.uploadedBy, members.id)).where(and(eq(attachments.brand, brandName), isNull(attachments.deletedAt))).orderBy(desc(attachments.createdAt)),
    db.select({ event: activity, actor: members.name }).from(activity).innerJoin(members, eq(activity.actorId, members.id)).where(eq(activity.brand, brandName)).orderBy(desc(activity.createdAt)).limit(100),
  ]);
  return { updates: allUpdates, tasks: allTasks, workspaceItems: allWorkspaceItems, attachments: allAttachments, activity: allActivity };
}

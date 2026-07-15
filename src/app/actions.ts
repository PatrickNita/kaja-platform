"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentMember } from "../lib/auth";
import { db, memberSeed } from "../lib/db";
import { activity, members, tasks, updates } from "../lib/schema";

const title = z.string().trim().min(1).max(160);
const body = z.string().trim().min(1).max(4000);
const taskStatus = z.enum(["To do", "In progress", "Done"]);

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
  const member = await actor();
  const input = z.object({ title, body }).parse(Object.fromEntries(formData));
  const [record] = await db!.insert(updates).values({ ...input, createdBy: member.id, updatedBy: member.id }).returning();
  await db!.insert(activity).values({ actorId: member.id, entityType: "update", entityId: record.id, action: "created", summary: `added update “${record.title}”` });
  refresh();
}

export async function editUpdate(formData: FormData) {
  const member = await actor();
  const input = z.object({ id: z.coerce.number().int().positive(), title, body }).parse(Object.fromEntries(formData));
  await db!.update(updates).set({ title: input.title, body: input.body, updatedBy: member.id, updatedAt: new Date() }).where(and(eq(updates.id, input.id), isNull(updates.deletedAt)));
  await db!.insert(activity).values({ actorId: member.id, entityType: "update", entityId: input.id, action: "edited", summary: `edited update “${input.title}”` });
  refresh();
}

export async function createTask(formData: FormData) {
  const member = await actor();
  const input = z.object({ title }).parse(Object.fromEntries(formData));
  const [record] = await db!.insert(tasks).values({ title: input.title, createdBy: member.id, updatedBy: member.id }).returning();
  await db!.insert(activity).values({ actorId: member.id, entityType: "task", entityId: record.id, action: "created", summary: `created task “${record.title}”` });
  refresh();
}

export async function updateTask(formData: FormData) {
  const member = await actor();
  const input = z.object({ id: z.coerce.number().int().positive(), title, status: taskStatus }).parse(Object.fromEntries(formData));
  await db!.update(tasks).set({ title: input.title, status: input.status, updatedBy: member.id, updatedAt: new Date() }).where(and(eq(tasks.id, input.id), isNull(tasks.deletedAt)));
  await db!.insert(activity).values({ actorId: member.id, entityType: "task", entityId: input.id, action: "updated", summary: `updated task “${input.title}” to ${input.status}` });
  refresh();
}

export async function deleteRecord(formData: FormData) {
  const member = await actor();
  const input = z.object({ id: z.coerce.number().int().positive(), type: z.enum(["task", "update"]), title }).parse(Object.fromEntries(formData));
  const table = input.type === "task" ? tasks : updates;
  await db!.update(table).set({ deletedAt: new Date(), updatedBy: member.id, updatedAt: new Date() }).where(eq(table.id, input.id));
  await db!.insert(activity).values({ actorId: member.id, entityType: input.type, entityId: input.id, action: "deleted", summary: `deleted ${input.type} “${input.title}”` });
  refresh();
}

export async function workspaceData() {
  if (!db) return null;
  for (const member of memberSeed) await db.insert(members).values(member).onConflictDoNothing();
  const [allUpdates, allTasks, allActivity] = await Promise.all([
    db.select({ update: updates, author: members.name }).from(updates).innerJoin(members, eq(updates.createdBy, members.id)).where(isNull(updates.deletedAt)).orderBy(desc(updates.updatedAt)),
    db.select({ task: tasks, author: members.name }).from(tasks).innerJoin(members, eq(tasks.createdBy, members.id)).where(isNull(tasks.deletedAt)).orderBy(desc(tasks.updatedAt)),
    db.select({ event: activity, actor: members.name }).from(activity).innerJoin(members, eq(activity.actorId, members.id)).orderBy(desc(activity.createdAt)).limit(20),
  ]);
  return { updates: allUpdates, tasks: allTasks, activity: allActivity };
}

"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentMember } from "../lib/auth";
import { db } from "../lib/db";
import { attachmentFolders, attachments, members } from "../lib/schema";

export async function saveUploadFolder(_: { error: string }, form: FormData) {
  const member = await currentMember();
  if (member?.slug !== "patrick" || !db) return { error: "Doar Patrick poate administra dosare." };
  const brand = String(form.get("brand") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const subtitle = String(form.get("subtitle") ?? "").trim();
  const rawId = form.get("id"); const id = rawId ? Number(rawId) : null;
  if (!["kaja", "hexenwerk", "virginia"].includes(brand) || !title || title.length > 160 || subtitle.length > 300 || (id !== null && (!Number.isSafeInteger(id) || id < 1))) return { error: "Verifică brandul, titlul și subtitlul." };
  let folderId = id;
  try {
    await db.insert(members).values(member).onConflictDoNothing();
    const [actor] = await db.select().from(members).where(eq(members.slug, member.slug));
    if (id) {
      const [updated] = await db.update(attachmentFolders).set({ title, subtitle }).where(and(eq(attachmentFolders.id, id), eq(attachmentFolders.brand, brand), isNull(attachmentFolders.deletedAt))).returning();
      if (!updated) return { error: "Dosarul nu mai există." };
    } else {
      const [folder] = await db.insert(attachmentFolders).values({ brand, title, subtitle, createdBy: actor.id }).returning();
      folderId = folder.id;
    }
  } catch { return { error: "Dosarul nu a putut fi salvat. Încearcă din nou." }; }
  revalidatePath("/");
  redirect(`/?view=uploads&brand=${brand}&folder=${folderId}`);
}

export async function deleteUploadFolder(form: FormData) {
  const member = await currentMember();
  if (member?.slug !== "patrick" || !db) throw new Error("Acces interzis.");
  const id = Number(form.get("id"));
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Dosar invalid.");
  // Never remove a folder that already contains live files.
  const { sql } = await import("drizzle-orm");
  await db.update(attachmentFolders).set({ deletedAt: new Date() }).where(and(eq(attachmentFolders.id, id), isNull(attachmentFolders.deletedAt), sql`not exists(select 1 from ${attachments} where ${attachments.folderId} = ${id} and ${attachments.deletedAt} is null)`));
  revalidatePath("/");
  redirect("/?view=uploads");
}

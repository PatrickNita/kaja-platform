import { del, head } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { and, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { currentMember } from "../../../lib/auth";
import { db, memberSeed } from "../../../lib/db";
import { activity, members, workspaceItemImages, workspaceItems } from "../../../lib/schema";
import { notifyTelegram } from "../../../lib/telegram";
import { canManageWorkspaceItem, supportsImageGallery } from "../../../lib/workspace-permissions";

const brands = ["kaja", "hexenwerk", "virginia"] as const;
const imageTypes = ["image/jpeg", "image/png", "image/webp"];
type Brand = (typeof brands)[number];
type UploadPayload = { mode?: "create-merch" | "append"; brand?: string; title?: string; body?: string; itemId?: number };

export async function POST(request: Request) {
  const requestBody = await request.json() as HandleUploadBody;
  const response = await handleUpload({
    body: requestBody,
    request,
    onBeforeGenerateToken: async (_pathname, clientPayload) => {
      const sessionMember = await currentMember();
      const payload = JSON.parse(clientPayload || "{}") as UploadPayload;
      if (!sessionMember || !db || !brands.includes(payload.brand as Brand)) throw new Error("Sesiune sau brand invalid.");
      await db.insert(members).values(sessionMember).onConflictDoNothing();
      const [member] = await db.select().from(members).where(eq(members.slug, sessionMember.slug));
      if (!member) throw new Error("Membrul nu a putut fi încărcat.");

      if (payload.mode === "create-merch") {
        const title = payload.title?.trim();
        const description = payload.body?.trim();
        if (member.slug !== "patrick") throw new Error("Doar Patrick poate adăuga produse Merch.");
        if (!title || title.length > 160 || !description || description.length > 4000) throw new Error("Titlul și descrierea sunt obligatorii.");
        return { allowedContentTypes: imageTypes, maximumSizeInBytes: 10 * 1024 * 1024, addRandomSuffix: true, tokenPayload: JSON.stringify({ mode: payload.mode, brand: payload.brand, title, body: description, slug: member.slug }) };
      }

      const itemId = Number(payload.itemId);
      if (payload.mode !== "append" || !Number.isInteger(itemId) || itemId < 1) throw new Error("Înregistrare invalidă.");
      const [item] = await db.select().from(workspaceItems).where(and(eq(workspaceItems.id, itemId), eq(workspaceItems.brand, payload.brand as Brand), isNull(workspaceItems.deletedAt)));
      if (!item || !supportsImageGallery(item)) throw new Error("Galeria nu este disponibilă pentru această înregistrare.");
      if (!canManageWorkspaceItem(member, item)) throw new Error("Nu ai permisiunea să modifici această galerie.");
      return { allowedContentTypes: imageTypes, maximumSizeInBytes: 10 * 1024 * 1024, addRandomSuffix: true, tokenPayload: JSON.stringify({ mode: payload.mode, brand: payload.brand, itemId, slug: member.slug }) };
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      if (!db || !tokenPayload) return;
      const payload = JSON.parse(tokenPayload) as { mode: "create-merch" | "append"; brand: Brand; title?: string; body?: string; itemId?: number; slug: string };
      const seededMember = memberSeed.find((member) => member.slug === payload.slug);
      if (!seededMember || !brands.includes(payload.brand)) { await del(blob.url); return; }
      const storedBlob = await head(blob.url);
      if (!imageTypes.includes(storedBlob.contentType)) { await del(blob.url); return; }
      await db.insert(members).values(seededMember).onConflictDoNothing();
      const [member] = await db.select().from(members).where(eq(members.slug, payload.slug));
      if (!member) { await del(blob.url); return; }

      let createdItemId: number | null = null;
      try {
        if (payload.mode === "create-merch") {
          const [item] = await db.insert(workspaceItems).values({ brand: payload.brand, section: "merch", title: payload.title!, body: payload.body!, merchImageUrl: blob.url, merchImagePathname: blob.pathname, createdBy: member.id, updatedBy: member.id }).returning();
          createdItemId = item.id;
          await db.insert(workspaceItemImages).values({ brand: payload.brand, itemId: item.id, pathname: blob.pathname, url: blob.url, position: 0, uploadedBy: member.id });
          await db.insert(activity).values({ brand: payload.brand, actorId: member.id, entityType: "merch", entityId: item.id, action: "created", summary: `a creat produsul merch „${item.title}”` });
          await notifyTelegram({ memberName: member.name, brand: payload.brand, entityType: "merch", action: "created", title: item.title });
          return;
        }

        const [item] = await db.select().from(workspaceItems).where(and(eq(workspaceItems.id, payload.itemId!), eq(workspaceItems.brand, payload.brand), isNull(workspaceItems.deletedAt)));
        if (!item || !supportsImageGallery(item) || !canManageWorkspaceItem(member, item)) throw new Error("Înregistrarea nu mai este disponibilă.");
        const [lastImage] = await db.select({ position: workspaceItemImages.position }).from(workspaceItemImages).where(and(eq(workspaceItemImages.itemId, item.id), eq(workspaceItemImages.brand, payload.brand), isNull(workspaceItemImages.deletedAt))).orderBy(desc(workspaceItemImages.position)).limit(1);
        await db.insert(workspaceItemImages).values({ brand: payload.brand, itemId: item.id, pathname: blob.pathname, url: blob.url, position: (lastImage?.position ?? -1) + 1, uploadedBy: member.id });
        await db.insert(activity).values({ brand: payload.brand, actorId: member.id, entityType: item.section, entityId: item.id, action: "image_uploaded", summary: `a adăugat o imagine la „${item.title}”` });
        await notifyTelegram({ memberName: member.name, brand: payload.brand, entityType: item.section as "events" | "catalogue" | "merch", action: "image_uploaded", title: item.title, catalogueGroup: item.catalogueGroup });
      } catch (error) {
        if (createdItemId) {
          await db.delete(workspaceItemImages).where(eq(workspaceItemImages.itemId, createdItemId));
          await db.delete(workspaceItems).where(eq(workspaceItems.id, createdItemId));
        }
        await del(blob.url);
        throw error;
      }
    },
  });
  return NextResponse.json(response);
}

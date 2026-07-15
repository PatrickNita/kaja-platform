import { head } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { currentMember } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { activity, members, workspaceItems } from "../../../lib/schema";

const brands = ["kaja", "hexenwerk"] as const;

export async function POST(request: Request) {
  const body = await request.json() as HandleUploadBody;
  const response = await handleUpload({
    body, request,
    onBeforeGenerateToken: async (_pathname, clientPayload) => {
      const sessionMember = await currentMember();
      const payload = JSON.parse(clientPayload || "{}") as { itemId?: number; brand?: string };
      if (!sessionMember || !Number.isInteger(payload.itemId) || !brands.includes(payload.brand as typeof brands[number]) || !db) throw new Error("Unauthorized upload.");
      const [item] = await db.select().from(workspaceItems).where(and(eq(workspaceItems.id, payload.itemId!), eq(workspaceItems.brand, payload.brand!), eq(workspaceItems.section, "merch"), isNull(workspaceItems.deletedAt)));
      if (!item) throw new Error("Merch record not found.");
      return { allowedContentTypes: ["image/jpeg", "image/png", "image/webp"], maximumSizeInBytes: 10 * 1024 * 1024, addRandomSuffix: true, tokenPayload: JSON.stringify({ ...payload, slug: sessionMember.slug }) };
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      if (!db || !tokenPayload) return;
      const payload = JSON.parse(tokenPayload) as { itemId: number; brand: typeof brands[number]; slug: string };
      const [item] = await db.select().from(workspaceItems).where(and(eq(workspaceItems.id, payload.itemId), eq(workspaceItems.brand, payload.brand), eq(workspaceItems.section, "merch"), isNull(workspaceItems.deletedAt)));
      if (!item) return;
      const storedBlob = await head(blob.url);
      if (!storedBlob.contentType.startsWith("image/")) return;
      if (item.merchImageUrl) { const { del } = await import("@vercel/blob"); await del(item.merchImageUrl); }
      await db.update(workspaceItems).set({ merchImageUrl: blob.url, merchImagePathname: blob.pathname, updatedAt: new Date() }).where(eq(workspaceItems.id, item.id));
      const [member] = await db.select().from(members).where(eq(members.slug, payload.slug));
      if (member) await db.insert(activity).values({ brand: payload.brand, actorId: member.id, entityType: "merch", entityId: item.id, action: "image_uploaded", summary: `added image to merch “${item.title}”` });
    },
  });
  return NextResponse.json(response);
}

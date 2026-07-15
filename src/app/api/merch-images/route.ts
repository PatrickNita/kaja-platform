import { del, head } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { currentMember } from "../../../lib/auth";
import { db, memberSeed } from "../../../lib/db";
import { activity, members, workspaceItems } from "../../../lib/schema";

const brands = ["kaja", "hexenwerk", "virginia"] as const;
type Brand = (typeof brands)[number];

export async function POST(request: Request) {
  const body = await request.json() as HandleUploadBody;
  const response = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (_pathname, clientPayload) => {
      const sessionMember = await currentMember();
      const payload = JSON.parse(clientPayload || "{}") as { brand?: string; title?: string; body?: string };
      const title = payload.title?.trim();
      const description = payload.body?.trim();
      if (!sessionMember || !db || !brands.includes(payload.brand as Brand) || !title || title.length > 160 || !description || description.length > 4000) throw new Error("A title, description, and valid brand are required.");
      if (sessionMember.slug !== "patrick") throw new Error("Doar Patrick poate adăuga produse merch.");
      return {
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
        maximumSizeInBytes: 10 * 1024 * 1024,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ brand: payload.brand, title, body: description, slug: sessionMember.slug }),
      };
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      if (!db || !tokenPayload) return;
      const payload = JSON.parse(tokenPayload) as { brand: Brand; title: string; body: string; slug: string };
      const seededMember = memberSeed.find((member) => member.slug === payload.slug);
      if (!seededMember || !brands.includes(payload.brand)) { await del(blob.url); return; }
      const storedBlob = await head(blob.url);
      if (!storedBlob.contentType.startsWith("image/")) { await del(blob.url); return; }
      await db.insert(members).values(seededMember).onConflictDoNothing();
      const [member] = await db.select().from(members).where(eq(members.slug, payload.slug));
      if (!member) { await del(blob.url); return; }
      try {
        const [item] = await db.insert(workspaceItems).values({
          brand: payload.brand,
          section: "merch",
          title: payload.title,
          body: payload.body,
          merchImageUrl: blob.url,
          merchImagePathname: blob.pathname,
          createdBy: member.id,
          updatedBy: member.id,
        }).returning();
        await db.insert(activity).values({ brand: payload.brand, actorId: member.id, entityType: "merch", entityId: item.id, action: "created", summary: `created merch “${item.title}” with image` });
      } catch (error) {
        await del(blob.url);
        throw error;
      }
    },
  });
  return NextResponse.json(response);
}

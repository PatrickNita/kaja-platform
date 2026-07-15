import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { head } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { currentMember } from "../../../lib/auth";
import { db, memberSeed } from "../../../lib/db";
import { activity, attachments, members } from "../../../lib/schema";

export async function POST(request: Request) {
  const body = await request.json() as HandleUploadBody;
  const response = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (_pathname, clientPayload) => {
      const member = await currentMember();
      if (!member) throw new Error("Unauthorized upload.");
      const payload = JSON.parse(clientPayload || "{}") as { filename?: string };
      if (!payload.filename?.toLowerCase().endsWith(".pdf")) throw new Error("Only PDF files are allowed.");
      return { allowedContentTypes: ["application/pdf"], maximumSizeInBytes: 25 * 1024 * 1024, addRandomSuffix: true, tokenPayload: JSON.stringify({ slug: member.slug, filename: payload.filename }) };
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      if (!db || !tokenPayload || blob.contentType !== "application/pdf") return;
      const payload = JSON.parse(tokenPayload) as { slug: string; filename: string };
      const seededMember = memberSeed.find((member) => member.slug === payload.slug);
      if (!seededMember) return;
      await db.insert(members).values(seededMember).onConflictDoNothing();
      const [member] = await db.select().from(members).where(eq(members.slug, payload.slug));
      if (!member) return;
      const storedBlob = await head(blob.url);
      const [attachment] = await db.insert(attachments).values({ filename: payload.filename, pathname: blob.pathname, url: blob.url, size: storedBlob.size, uploadedBy: member.id }).onConflictDoNothing().returning();
      if (attachment) await db.insert(activity).values({ actorId: member.id, entityType: "attachment", entityId: attachment.id, action: "uploaded", summary: `uploaded PDF “${attachment.filename}”` });
    },
  });
  return NextResponse.json(response);
}

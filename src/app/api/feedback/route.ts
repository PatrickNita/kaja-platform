import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { feedbackInput } from "../../../lib/feedback-model";
import { feedbackQuery } from "../../../lib/feedback-server";
import { feedbackSourceHash, validFeedbackChallenge } from "../../../lib/feedback-security";

const reply = (data: object, status: number) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return reply({ code: "invalid" }, 403);
  if (Number(request.headers.get("content-length") || 0) > 16000) return reply({ code: "invalid" }, 413);
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 16000) return reply({ code: "invalid" }, 413);
    const input = feedbackInput.safeParse(JSON.parse(text));
    if (!input.success || input.data.website || !validFeedbackChallenge(input.data.product, input.data.challenge)) return reply({ code: "invalid" }, 400);
    // Vercel overwrites x-forwarded-for at ingress. Do not prefer a caller-supplied alternate header.
    const source = process.env.VERCEL ? request.headers.get("x-forwarded-for") : "local";
    if (!source) return reply({ code: "unavailable" }, 503);
    const data = input.data;
    const [result] = await feedbackQuery<{ result: string }>(sql`select submit_product_feedback(${data.product}::uuid,${data.body},${data.requestId}::uuid,${feedbackSourceHash(source.split(",")[0].trim())}) as result`);
    if (result?.result === "ok") return reply({ ok: true }, 200);
    return reply({ code: result?.result || "unavailable" }, result?.result === "limited" ? 429 : result?.result === "invalid" ? 400 : 404);
  } catch {
    return reply({ code: "unavailable" }, 503);
  }
}

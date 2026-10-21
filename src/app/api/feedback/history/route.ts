import { NextResponse } from "next/server";
import { currentMember } from "../../../../lib/auth";
import { memberFeedbackHistory } from "../../../../lib/feedback-server";
import { decodeHistoryCursor, encodeHistoryCursor, historyBrand } from "../../../../lib/feedback-history";
function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
export async function GET(request: Request) {
  if (!await currentMember()) return json({ error: "Acces neautorizat." }, 401);
  const params = new URL(request.url).searchParams;
  const brand = params.get("brand") ?? "all", cursor = params.get("before");
  const before = cursor ? decodeHistoryCursor(cursor) : null;
  const unread = params.get("unread"), selected = params.get("comment");
  const commentId = selected === null ? undefined : Number(selected);
  if ((unread !== null && unread !== "1") || (selected !== null && (!/^\d+$/.test(selected) || !Number.isInteger(commentId) || commentId! < 1 || commentId! > 2147483647 || cursor !== null))) return json({ error: "Cerere invalidă." }, 400);
  if (!["all", "kaja", "hexenwerk", "virginia"].includes(brand) || (cursor !== null && !before)) return json({ error: "Cerere invalidă." }, 400);
  try {
    const rows = await memberFeedbackHistory(historyBrand(brand), before, unread === "1", commentId);
    const comments = rows.slice(0, 50);
    return json({ comments, nextCursor: rows.length > 50 ? encodeHistoryCursor(comments[49]) : null });
  } catch {
    return json({ error: "Istoricul nu a putut fi încărcat. Încearcă din nou." }, 503);
  }
}

import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { currentMember } from "../../../../../lib/auth";
import { publicFeedbackProduct } from "../../../../../lib/feedback-server";
import { feedbackOrigin } from "../../../../../lib/feedback-security";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await currentMember()) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  if (!await publicFeedbackProduct(id)) return new NextResponse(null, { status: 404 });
  const svg = await QRCode.toString(`${feedbackOrigin()}/feedback/${id}`, { type: "svg", margin: 4, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  return new NextResponse(svg, { headers: {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "private, no-store",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    ...(request.nextUrl.searchParams.has("download") ? { "Content-Disposition": `attachment; filename="feedback-${id}.svg"` } : {}),
  } });
}

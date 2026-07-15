import { NextResponse } from "next/server";
import { setMemberSession, validLink } from "../../../../lib/auth";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  if (!validLink(slug, token)) return new NextResponse("This member link is invalid or has expired.", { status: 404 });
  await setMemberSession(slug as "patrick" | "ionut" | "igor" | "andrei");
  return NextResponse.redirect(new URL("/", _.url));
}

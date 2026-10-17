import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { query, B2B_COOKIE, SUPPORT } from "../../../../../lib/b2b/server";
import { tokenHash, sessionValue } from "../../../../../lib/b2b/crypto";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; token: string }> },
) {
  const { id, token } = await params;
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
  };
  if (
    !/^\d+$/.test(id) ||
    !Number.isSafeInteger(Number(id)) ||
    Number(id) < 1 ||
    Number(id) > 2147483647 ||
    !/[A-Za-z0-9_-]{43}/.test(token) ||
    token.length !== 43
  )
    return new NextResponse(SUPPORT, { status: 404, headers });
  const [location] = await query<{ id: number; version: number }>(
    sql`select id,version from b2b_locations where id=${Number(id)} and token_hash=${tokenHash(token)}`,
  );
  if (!location) {
    const response = new NextResponse(SUPPORT, { status: 404, headers });
    response.cookies.delete(B2B_COOKIE);
    return response;
  }
  const response = NextResponse.redirect(new URL("/comenzi", request.url));
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
  response.cookies.set(
    B2B_COOKIE,
    sessionValue(location.id, location.version),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    },
  );
  return response;
}

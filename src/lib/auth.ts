import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { memberSeed } from "./db";

const COOKIE = "kaja_member";
type MemberSlug = (typeof memberSeed)[number]["slug"];

function signature(value: string) {
  return createHmac("sha256", process.env.SESSION_SECRET || "development-only-secret").update(value).digest("hex");
}

export function validLink(slug: string, token: string) {
  const entries = (process.env.MEMBER_LINKS || "").split(",").map((entry) => entry.split(":"));
  const match = entries.find(([entrySlug]) => entrySlug === slug)?.[1];
  if (!match) return false;
  const left = Buffer.from(match);
  const right = Buffer.from(token);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function setMemberSession(slug: MemberSlug) {
  const value = `${slug}.${signature(slug)}`;
  const store = await cookies();
  store.set(COOKIE, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, path: "/" });
}

export async function currentMember() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const [slug, sig] = value.split(".");
  const known = memberSeed.find((member) => member.slug === slug);
  const expected = signature(slug || "");
  if (!known || !sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return known;
}

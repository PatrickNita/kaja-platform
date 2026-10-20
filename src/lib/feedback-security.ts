import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("Feedback signing key unavailable");
  return value;
}
function sign(value: string) { return createHmac("sha256", secret()).update(`feedback:${value}`).digest("hex"); }
export function feedbackChallenge(id: string, now = Date.now()) {
  const time = String(now);
  return `${time}.${sign(`${id}:${time}`)}`;
}
export function validFeedbackChallenge(id: string, token: string, now = Date.now()) {
  const [time, signature] = token.split(".");
  if (!/^\d{13}$/.test(time ?? "") || !/^[a-f0-9]{64}$/.test(signature ?? "")) return false;
  const age = now - Number(time);
  return age >= 2000 && age <= 86400000 && timingSafeEqual(Buffer.from(signature), Buffer.from(sign(`${id}:${time}`)));
}
export function feedbackSourceHash(source: string) {
  return sign(`source:${source}`);
}
export function feedbackOrigin() {
  return process.env.FEEDBACK_PUBLIC_ORIGIN || "https://kaja-platform.vercel.app";
}

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
function key() {
  const value = process.env.B2B_LINK_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error("Configurarea accesului B2B lipsește.");
  return Buffer.from(value, "hex");
}
export function newToken() {
  return randomBytes(32).toString("base64url");
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data]
    .map((v) => v.toString("base64url"))
    .join(".");
}
export function decryptToken(value: string) {
  const [iv, tag, data] = value
    .split(".")
    .map((v) => Buffer.from(v, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", key(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8");
}
export function sessionValue(
  id: number,
  version: number,
  expires = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
) {
  const value = id + "." + version + "." + expires;
  return (
    value +
    "." +
    createHmac("sha256", key())
      .update("b2b:" + value)
      .digest("hex")
  );
}
export function parseSession(value: string) {
  const [id, version, expires] = value.split(".").map(Number);
  if (
    !Number.isSafeInteger(id) ||
    id < 1 ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    !Number.isSafeInteger(expires) ||
    expires <= Math.floor(Date.now() / 1000)
  )
    return null;
  const expected = sessionValue(id, version, expires);
  return value.length === expected.length &&
    timingSafeEqual(Buffer.from(value), Buffer.from(expected))
    ? { id, version }
    : null;
}

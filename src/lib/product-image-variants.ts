import { get, head, put, del, BlobNotFoundError, BlobPreconditionFailedError } from "@vercel/blob";
import { imageVariantPath, imageVariantUrl, imageVariantSpecs, type ImageVariant } from "./image-variant-path.ts";

export async function ensureProductImageVariants(record: { pathname: string; url: string }, source?: Buffer) {
  const result: { variant: ImageVariant; pathname: string; url: string; size: number }[] = [];
  for (const variant of Object.keys(imageVariantSpecs) as ImageVariant[]) {
    const pathname = imageVariantPath(record.pathname, variant);
    let existing;
    try { existing = await head(pathname); } catch (error) { if (!(error instanceof BlobNotFoundError)) throw error; }
    if (existing) {
      result.push({ variant, pathname, url: existing.url, size: existing.size });
      continue;
    }
    if (!source) {
      const original = await get(record.url, { access: "private" });
      if (!original || original.statusCode !== 200) throw Error("Source image unavailable");
      source = Buffer.from(await new Response(original.stream).arrayBuffer());
    }
    const { default: sharp } = await import("sharp");
    const spec = imageVariantSpecs[variant];
    const bytes = await sharp(source, { limitInputPixels: 40_000_000 }).rotate()
      .resize(spec.size, spec.size, { fit: "contain", background: "#000000" })
      .webp({ quality: spec.quality, effort: 6 }).toBuffer();
    try {
      const blob = await put(pathname, bytes, { access: "private", contentType: "image/webp", addRandomSuffix: false, allowOverwrite: false });
      result.push({ variant, pathname, url: blob.url, size: bytes.byteLength });
    } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError)) throw error;
      const blob = await head(pathname);
      result.push({ variant, pathname, url: blob.url, size: blob.size });
    }
  }
  return result;
}
export async function deleteProductImageVariants(record: { pathname: string; url: string }) {
  await del((Object.keys(imageVariantSpecs) as ImageVariant[]).map(variant => imageVariantUrl(record, variant)));
}

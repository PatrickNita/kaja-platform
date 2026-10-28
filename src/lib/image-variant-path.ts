export const imageVariantSpecs = {
  thumb: { size: 96, quality: 72 },
  preview: { size: 320, quality: 78 },
} as const;
export type ImageVariant = keyof typeof imageVariantSpecs;
export function isImageVariant(value: string | null): value is ImageVariant {
  return value === "thumb" || value === "preview";
}
export function imageVariantPath(pathname: string, variant: ImageVariant) {
  if (!pathname || pathname.startsWith("/") || pathname.split("/").some(part => part === "..")) throw Error("Invalid image pathname");
  return `image-variants/v1/${pathname}.${variant}.webp`;
}
export function imageVariantUrl(record: { pathname: string; url: string }, variant: ImageVariant) {
  const url = new URL(record.url);
  url.pathname = "/" + imageVariantPath(record.pathname, variant);
  url.search = "";
  url.hash = "";
  return url.href;
}

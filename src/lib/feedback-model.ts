import { z } from "zod";

export const feedbackBrands = [
  { key: "kaja", label: "KAJA" },
  { key: "hexenwerk", label: "HEXENWERK" },
  { key: "virginia", label: "LUMEN" },
] as const;
export type FeedbackBrand = (typeof feedbackBrands)[number]["key"];
export type FeedbackProduct = { id: string; brand: string; name: string; flavor: string; slug: string };
export function feedbackPath(product: Pick<FeedbackProduct, "brand" | "slug">) {
  const brand = product.brand === "virginia" ? "lumen" : product.brand;
  return `/feedback/${brand}/${product.slug}`;
}
export type ProductComment = { id: number; body: string; createdAt: string };
export const feedbackInput = z.object({
  product: z.uuid(),
  body: z.string().trim().min(1).max(2000),
  requestId: z.uuid(),
  challenge: z.string().max(300),
  website: z.string().max(200).default(""),
});
export function feedbackBrand(value?: string): FeedbackBrand {
  return feedbackBrands.find((b) => b.key === value)?.key ?? "kaja";
}

import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { currentMember } from "./auth";
import { z } from "zod";
import type { FeedbackBrand, FeedbackProduct, ProductComment } from "./feedback-model";

export async function feedbackQuery<T>(statement: ReturnType<typeof sql>): Promise<T[]> {
  if (!db) throw new Error("Database unavailable");
  return (await db.execute(statement)).rows as T[];
}
export async function publicFeedbackProduct(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await feedbackQuery<FeedbackProduct>(sql`select feedback_id as id,brand,product_name as name,flavor from workspace_items where feedback_id=${id}::uuid and section='catalogue' and catalogue_group='live' and deleted_at is null and nullif(btrim(product_name),'') is not null and nullif(btrim(flavor),'') is not null`);
  return row ?? null;
}
export async function memberFeedbackProducts(brand: FeedbackBrand) {
  if (!await currentMember()) throw new Error("Unauthorized");
  return feedbackQuery<FeedbackProduct>(sql`select feedback_id as id,brand,product_name as name,flavor from workspace_items where brand=${brand} and section='catalogue' and catalogue_group='live' and deleted_at is null and nullif(btrim(product_name),'') is not null and nullif(btrim(flavor),'') is not null order by lower(product_name),id`);
}
export async function memberProductComments(id: string, before?: number) {
  if (!await currentMember()) throw new Error("Unauthorized");
  return feedbackQuery<ProductComment>(sql`select f.id,f.body,f.created_at as "createdAt" from product_feedback f join workspace_items w on w.id=f.item_id where w.feedback_id=${id}::uuid ${before ? sql`and f.id<${before}` : sql``} order by f.id desc limit 51`);
}

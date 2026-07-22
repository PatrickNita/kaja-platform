import { db } from "./db";
import { activity } from "./schema";
import { enqueueTelegramDigest, type TelegramAction, type TelegramEntityType, type TelegramReactionType } from "./telegram";

export type ActivityBrand = "kaja" | "hexenwerk" | "virginia";

export type ActivityEvent = {
  brand: ActivityBrand;
  entityType: TelegramEntityType;
  entityId: number;
  action: TelegramAction;
  summary: string;
  title: string;
  catalogueGroup?: string | null;
  reactionType?: TelegramReactionType | null;
};

export async function recordActivity(member: { id: number; name: string }, event: ActivityEvent) {
  if (!db) throw new Error("Baza de date nu este configurată.");
  await db.insert(activity).values({
    brand: event.brand,
    actorId: member.id,
    entityType: event.entityType,
    entityId: event.entityId,
    action: event.action,
    summary: event.summary,
  });

  try {
    await enqueueTelegramDigest({
      actorId: member.id,
      memberName: member.name,
      brand: event.brand,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      title: event.title,
      catalogueGroup: event.catalogueGroup,
      reactionType: event.reactionType,
    });
  } catch (error) {
    console.error("Telegram digest scheduling failed", error);
  }
}

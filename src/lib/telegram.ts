import { send } from "@vercel/queue";
import { and, asc, eq, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { telegramDebounce, telegramOutbox } from "./schema";

export const TELEGRAM_DIGEST_TOPIC = "telegram-digest";
export const TELEGRAM_DIGEST_DELAY_SECONDS = 30 * 60;
const TELEGRAM_DIGEST_RETENTION_SECONDS = 7 * 24 * 60 * 60;
const TELEGRAM_MESSAGE_LIMIT = 4096;
const PROCESSING_LOCK_SECONDS = 5 * 60;

export type TelegramBrand = "kaja" | "hexenwerk" | "virginia";
export type TelegramEntityType = "update" | "task" | "events" | "catalogue" | "merch" | "information" | "attachment";
export type TelegramReactionType = "heart" | "like" | "dislike" | "poop" | "question";
export type TelegramAction =
  | "created"
  | "edited"
  | "updated"
  | "deleted"
  | "uploaded"
  | "commented"
  | "comment_deleted"
  | "image_uploaded"
  | "image_deleted"
  | "reacted"
  | "attention_requested";

export type TelegramDigestEventInput = {
  activityId: number;
  actorId: number;
  memberName: string;
  brand: TelegramBrand;
  entityType: TelegramEntityType;
  entityId: number;
  action: TelegramAction;
  title: string;
  catalogueGroup?: string | null;
  reactionType?: TelegramReactionType | null;
};

export type TelegramDigestQueueMessage = {
  actorId: number;
  generation: string;
};

type DigestEvent = Omit<TelegramDigestEventInput, "reactionType" | "activityId"> & {
  id: number;
  reactionType: string | null;
  createdAt: Date;
};

type DigestGroup = {
  memberName: string;
  action: TelegramAction;
  entityType: TelegramEntityType;
  catalogueGroup: string | null;
  reactionType: string | null;
  titles: string[];
  eventCount: number;
};

const brandOrder: TelegramBrand[] = ["kaja", "hexenwerk", "virginia"];
const reactionEmoji: Record<string, string> = {
  heart: "❤️",
  like: "👍",
  dislike: "👎",
  poop: "💩",
  question: "❓",
  "❤️": "❤️",
  "👍": "👍",
  "👎": "👎",
  "💩": "💩",
  "❓": "❓",
};

function cleanTitle(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function entityName(entityType: TelegramEntityType, catalogueGroup: string | null, plural: boolean) {
  if (entityType === "update") return plural ? "propunerile" : "propunerea";
  if (entityType === "task") return plural ? "sarcinile" : "sarcina";
  if (entityType === "events") return plural ? "evenimentele" : "evenimentul";
  if (entityType === "merch") return plural ? "produsele Merch" : "produsul Merch";
  if (entityType === "information") return plural ? "informațiile" : "informația";
  if (entityType === "attachment") return plural ? "PDF-urile" : "PDF-ul";
  if (catalogueGroup === "ideas") return plural ? "ideile din catalog" : "ideea din catalog";
  if (catalogueGroup === "upcoming") return plural ? "produsele din În curând" : "produsul din În curând";
  return plural ? "produsele din Catalog activ" : "produsul din Catalog activ";
}

function titleList(titles: string[]) {
  const quoted = titles.map((title) => `„${cleanTitle(title)}”`);
  if (quoted.length <= 1) return quoted[0] ?? "";
  if (quoted.length === 2) return `${quoted[0]} și ${quoted[1]}`;
  return `${quoted.slice(0, -1).join(", ")} și ${quoted.at(-1)}`;
}

function actionPhrase(group: DigestGroup, visibleTitleCount = group.titles.length) {
  const noun = entityName(group.entityType, group.catalogueGroup, visibleTitleCount > 1);
  if (group.action === "created") return `a creat ${noun}`;
  if (group.action === "edited" || group.action === "updated") return `a modificat ${noun}`;
  if (group.action === "deleted") return `a șters ${noun}`;
  if (group.action === "uploaded") return `a încărcat ${noun}`;
  if (group.action === "commented") return `a comentat la ${noun}`;
  if (group.action === "comment_deleted") return `a șters un comentariu de la ${noun}`;
  if (group.action === "image_uploaded") return `a adăugat o imagine la ${noun}`;
  if (group.action === "image_deleted") return `a șters o imagine din ${noun}`;
  if (group.action === "attention_requested") return `cere mai multă atenție la ${noun}`;
  const emoji = group.reactionType ? reactionEmoji[group.reactionType] : undefined;
  return `a reacționat${emoji ? ` cu ${emoji}` : ""} la ${noun}`;
}

function formatGroupLine(group: DigestGroup, maxLength = 900) {
  const allTitles = group.titles;
  const member = group.action === "attention_requested" ? `⚠️ ${group.memberName}` : group.memberName;
  let visible = allTitles.length;

  while (visible > 1) {
    const suffix = visible < allTitles.length ? ` … (+${allTitles.length - visible} titluri)` : "";
    const line = `• ${member} ${actionPhrase(group, visible)} ${titleList(allTitles.slice(0, visible))}${suffix}.`;
    if (line.length <= maxLength) return line;
    visible -= 1;
  }

  const omitted = Math.max(0, allTitles.length - 1);
  const suffix = omitted ? ` … (+${omitted} titluri)` : "";
  const prefix = `• ${member} ${actionPhrase(group, 1)} `;
  const available = Math.max(24, maxLength - prefix.length - suffix.length - 3);
  const firstTitle = cleanTitle(allTitles[0] ?? "Înregistrare");
  const shortened = firstTitle.length > available ? `${firstTitle.slice(0, Math.max(1, available - 1)).trimEnd()}…` : firstTitle;
  return `${prefix}„${shortened}”${suffix}.`;
}

function groupDigestEvents(events: DigestEvent[]) {
  const sections = new Map<TelegramBrand, Map<string, DigestGroup>>();
  for (const brand of brandOrder) sections.set(brand, new Map());

  for (const event of events) {
    const section = sections.get(event.brand);
    if (!section) continue;
    const key = [event.action, event.entityType, event.catalogueGroup ?? "", event.reactionType ?? ""].join(":");
    const existing = section.get(key);
    if (existing) {
      existing.eventCount += 1;
      const normalizedTitle = cleanTitle(event.title);
      if (!existing.titles.includes(normalizedTitle)) existing.titles.push(normalizedTitle);
      continue;
    }
    section.set(key, {
      memberName: event.memberName,
      action: event.action,
      entityType: event.entityType,
      catalogueGroup: event.catalogueGroup ?? null,
      reactionType: event.reactionType,
      titles: [cleanTitle(event.title)],
      eventCount: 1,
    });
  }
  return sections;
}

/** Pure formatter used by the queue consumer and easy to exercise without Vercel. */
export function formatTelegramDigest(events: DigestEvent[]) {
  if (!events.length) return null;
  const sections = groupDigestEvents(events);
  const totalEvents = events.length;
  let includedEvents = 0;
  let output = "";

  outer: for (const brand of brandOrder) {
    const groups = [...(sections.get(brand)?.values() ?? [])];
    if (!groups.length) continue;
    let headerAdded = false;

    for (const group of groups) {
      const header = headerAdded ? "" : `${output ? "\n\n" : ""}${brand.toUpperCase()}\n`;
      const line = formatGroupLine(group);
      const separator = headerAdded ? "\n" : "";
      const nextIncluded = includedEvents + group.eventCount;
      const remaining = totalEvents - nextIncluded;
      const footer = remaining > 0 ? `\n\n… și încă ${remaining} activități.` : "";

      if (`${output}${header}${separator}${line}${footer}`.length > TELEGRAM_MESSAGE_LIMIT) break outer;
      output += `${header}${separator}${line}`;
      includedEvents = nextIncluded;
      headerAdded = true;
    }
  }

  const omittedEvents = totalEvents - includedEvents;
  if (omittedEvents > 0) {
    const footer = `${output ? "\n\n" : ""}… și încă ${omittedEvents} activități.`;
    output = output.slice(0, TELEGRAM_MESSAGE_LIMIT - footer.length).trimEnd() + footer;
  }
  return output || null;
}

async function scheduleTelegramDigest(message: TelegramDigestQueueMessage, delaySeconds: number, phase: "initial" | "resume") {
  const delay = Math.max(0, Math.ceil(delaySeconds));
  await send(TELEGRAM_DIGEST_TOPIC, message, {
    delaySeconds: delay,
    retentionSeconds: TELEGRAM_DIGEST_RETENTION_SECONDS,
    idempotencyKey: `telegram-digest-${message.actorId}-${message.generation}-${phase}`,
  });
}

/**
 * Persists an activity for the member's next digest and moves that member's
 * inactivity deadline forward by 30 minutes. Failures are intentionally
 * isolated from the user-facing mutation that already succeeded.
 */
export async function enqueueTelegramDigest(input: TelegramDigestEventInput) {
  if (!db) return;
  const now = new Date();
  const dueAt = new Date(now.getTime() + TELEGRAM_DIGEST_DELAY_SECONDS * 1000);
  const generation = randomUUID();

  try {
    await db.batch([
      db.insert(telegramOutbox).values({
        activityId: input.activityId,
        actorId: input.actorId,
        memberName: input.memberName,
        brand: input.brand,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        title: input.title,
        catalogueGroup: input.catalogueGroup ?? null,
        reactionType: input.reactionType ?? null,
      }),
      db.insert(telegramDebounce).values({
        actorId: input.actorId,
        generation,
        lastActivityAt: now,
        dueAt,
        sentGeneration: null,
        processingGeneration: null,
        processingAt: null,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: telegramDebounce.actorId,
        set: {
          generation,
          lastActivityAt: now,
          dueAt,
          processingGeneration: null,
          processingAt: null,
          updatedAt: now,
        },
      }),
    ] as const);
  } catch (error) {
    console.error("Telegram digest outbox write failed", error);
    return;
  }

  try {
    await scheduleTelegramDigest({ actorId: input.actorId, generation }, TELEGRAM_DIGEST_DELAY_SECONDS, "initial");
  } catch (error) {
    console.error("Telegram digest scheduling failed", error);
  }
}

/** Invalidates the current timer after a retractable event is removed. */
export async function resetTelegramDigestAfterCancellation(actorId: number) {
  if (!db) return;
  const now = new Date();
  const generation = randomUUID();
  const dueAt = new Date(now.getTime() + TELEGRAM_DIGEST_DELAY_SECONDS * 1000);
  try {
    // Schedule first so a Queue outage leaves the previous generation valid;
    // other pending events still retain their existing delivery path.
    await scheduleTelegramDigest({ actorId, generation }, TELEGRAM_DIGEST_DELAY_SECONDS, "initial");
  } catch (error) {
    console.error("Telegram digest rescheduling failed", error);
    return;
  }

  try {
    await db.insert(telegramDebounce).values({
      actorId,
      generation,
      lastActivityAt: now,
      dueAt,
      sentGeneration: null,
      processingGeneration: null,
      processingAt: null,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: telegramDebounce.actorId,
      set: {
        generation,
        lastActivityAt: now,
        dueAt,
        sentGeneration: null,
        processingGeneration: null,
        processingAt: null,
        updatedAt: now,
      },
    });
  } catch (error) {
    console.error("Telegram digest timer reset failed", error);
  }
}

async function sendTelegramMessage(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("Telegram is not configured.");

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (!response.ok) throw new Error(`Telegram sendMessage failed with status ${response.status}.`);
}

async function releaseProcessingLock(actorId: number, generation: string) {
  if (!db) return;
  await db.update(telegramDebounce).set({
    processingGeneration: null,
    processingAt: null,
    updatedAt: new Date(),
  }).where(and(
    eq(telegramDebounce.actorId, actorId),
    eq(telegramDebounce.processingGeneration, generation),
  ));
}

async function completeDigest(actorId: number, generation: string, eventIds: number[]) {
  if (!db) return;
  const now = new Date();
  const finishDebounce = db.update(telegramDebounce).set({
    sentGeneration: generation,
    processingGeneration: null,
    processingAt: null,
    updatedAt: now,
  }).where(and(
    eq(telegramDebounce.actorId, actorId),
    eq(telegramDebounce.processingGeneration, generation),
  ));

  if (!eventIds.length) {
    await finishDebounce;
    return;
  }
  await db.batch([
    db.update(telegramOutbox).set({ sentAt: now }).where(and(
      inArray(telegramOutbox.id, eventIds),
      isNull(telegramOutbox.sentAt),
    )),
    finishDebounce,
  ] as const);
}

/** Idempotent, stale-generation-aware consumer invoked only by Vercel Queues. */
export async function processTelegramDigest(message: TelegramDigestQueueMessage) {
  if (!db) return;
  if (!Number.isInteger(message.actorId) || message.actorId <= 0 || typeof message.generation !== "string" || !message.generation) {
    console.error("Telegram digest ignored an invalid queue payload");
    return;
  }

  const [state] = await db.select().from(telegramDebounce).where(eq(telegramDebounce.actorId, message.actorId)).limit(1);
  if (!state || state.generation !== message.generation || state.sentGeneration === message.generation) return;

  const now = new Date();
  const remainingMilliseconds = state.dueAt.getTime() - now.getTime();
  if (remainingMilliseconds > 0) {
    await scheduleTelegramDigest(message, remainingMilliseconds / 1000, "resume");
    return;
  }

  const staleBefore = new Date(now.getTime() - PROCESSING_LOCK_SECONDS * 1000);
  const [claimed] = await db.update(telegramDebounce).set({
    processingGeneration: message.generation,
    processingAt: now,
    updatedAt: now,
  }).where(and(
    eq(telegramDebounce.actorId, message.actorId),
    eq(telegramDebounce.generation, message.generation),
    lte(telegramDebounce.dueAt, now),
    or(
      isNull(telegramDebounce.processingGeneration),
      lt(telegramDebounce.processingAt, staleBefore),
    ),
  )).returning();
  if (!claimed) return;

  const rows = await db.select().from(telegramOutbox).where(and(
    eq(telegramOutbox.actorId, message.actorId),
    isNull(telegramOutbox.sentAt),
    lte(telegramOutbox.createdAt, claimed.dueAt),
  )).orderBy(asc(telegramOutbox.createdAt), asc(telegramOutbox.id));

  const events = rows.map((row) => ({
    id: row.id,
    actorId: row.actorId,
    memberName: row.memberName,
    brand: row.brand as TelegramBrand,
    entityType: row.entityType as TelegramEntityType,
    entityId: row.entityId,
    action: row.action as TelegramAction,
    title: row.title,
    catalogueGroup: row.catalogueGroup,
    reactionType: row.reactionType,
    createdAt: row.createdAt,
  }));
  const text = formatTelegramDigest(events);

  try {
    const [latestState] = await db.select({
      generation: telegramDebounce.generation,
      processingGeneration: telegramDebounce.processingGeneration,
    }).from(telegramDebounce).where(eq(telegramDebounce.actorId, message.actorId)).limit(1);
    if (!latestState || latestState.generation !== message.generation || latestState.processingGeneration !== message.generation) return;
    if (text) await sendTelegramMessage(text);
    await completeDigest(message.actorId, message.generation, rows.map((row) => row.id));
  } catch (error) {
    try {
      await releaseProcessingLock(message.actorId, message.generation);
    } catch (releaseError) {
      console.error("Telegram digest lock release failed", releaseError);
    }
    console.error("Telegram digest delivery failed", error);
    throw error;
  }
}

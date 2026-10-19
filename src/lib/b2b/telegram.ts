import { send } from "@vercel/queue";
import { neon } from "@neondatabase/serverless";
import { deliverNotification } from "./telegram-delivery";
export const B2B_TELEGRAM_TOPIC = "b2b-telegram";
export async function enqueueOrderNotification(eventId: number) {
  if (process.env.VERCEL_ENV !== "production") return;
  try {
    await send(
      B2B_TELEGRAM_TOPIC,
      { eventId },
      {
        idempotencyKey: `b2b-telegram-${eventId}`,
        retentionSeconds: 7 * 24 * 60 * 60,
      },
    );
  } catch {
    console.error("B2B notification enqueue failed; pending event", eventId);
  }
}
export async function processOrderNotification(message: { eventId: number }) {
  if (process.env.VERCEL_ENV !== "production") return;
  if (process.env.TELEGRAM_B2B_CHAT_ID === process.env.TELEGRAM_CHAT_ID)
    throw new Error("B2B requires its own Telegram channel");
  if (!Number.isSafeInteger(message.eventId) || message.eventId < 1)
    throw new Error("Invalid notification ID");
  const db = neon(process.env.DATABASE_URL!);
  await deliverNotification(
    message.eventId,
    (text, params) => db.query(text, params),
    process.env.TELEGRAM_BOT_TOKEN ?? "",
    process.env.TELEGRAM_B2B_CHAT_ID ?? "",
  );
}

import { handleCallback } from "@vercel/queue";
import { processTelegramDigest, type TelegramDigestQueueMessage } from "../../../../lib/telegram";

export const runtime = "nodejs";

const queueHandler = handleCallback<TelegramDigestQueueMessage>(
  async (message) => {
    await processTelegramDigest(message);
  },
  {
    visibilityTimeoutSeconds: 60,
    retry: (error, metadata) => {
      console.error("Telegram digest queue attempt failed", metadata.deliveryCount, error);
      return { afterSeconds: Math.min(15 * 60, 30 * 2 ** Math.min(metadata.deliveryCount, 5)) };
    },
  },
);

export async function POST(request: Request) {
  return queueHandler(request);
}

import { handleCallback } from "@vercel/queue";
import { processOrderNotification } from "../../../../lib/b2b/telegram";
export const runtime = "nodejs";
export const POST = handleCallback<{ eventId: number }>(
  processOrderNotification,
  {
    visibilityTimeoutSeconds: 300,
    retry: (_error, metadata) => ({
      afterSeconds: Math.min(
        900,
        30 * 2 ** Math.min(metadata.deliveryCount, 5),
      ),
    }),
  },
);

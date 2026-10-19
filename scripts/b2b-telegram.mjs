// Run with production env only when intentionally delivering to the B2B channel.
// node --env-file=<private-env-file> scripts/b2b-telegram.mjs --pending
import { neon } from "@neondatabase/serverless";
import { deliverNotification } from "../src/lib/b2b/telegram-delivery.ts";
const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
const chatId = process.env.TELEGRAM_B2B_CHAT_ID ?? "";
if (!token || !/^-100\d+$/.test(chatId))
  throw Error("Configure TELEGRAM_BOT_TOKEN and TELEGRAM_B2B_CHAT_ID");
if (chatId === process.env.TELEGRAM_CHAT_ID)
  throw Error("B2B requires a separate channel");
if (process.argv.includes("--test")) {
  async function telegram(method, body) {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    }).catch(() => {
      throw Error("Telegram configuration check failed");
    });
    const d = await r.json();
    if (!r.ok || !d.ok)
      throw Error(`Telegram configuration check rejected (${r.status})`);
    return d.result;
  }
  const bot = await telegram("getMe", {}),
    chat = await telegram("getChat", { chat_id: chatId });
  if (chat.type !== "channel") throw Error("Destination must be a channel");
  const membership = await telegram("getChatMember", {
    chat_id: chatId,
    user_id: bot.id,
  });
  if (membership.status !== "administrator" || !membership.can_post_messages)
    throw Error("Bot requires administrator posting permission");
  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "TEST · KAJA B2B\nNotificările pentru comenzile noi și modificate sunt conectate la acest canal.\nAcesta este un test; nu a fost creată nicio comandă.",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(20000),
    },
  ).catch(() => {
    throw Error("Telegram test request failed");
  });
  const result = await response.json();
  if (!response.ok || !result.ok)
    throw Error(`Telegram test rejected (${response.status})`);
  console.log("TEST delivered to B2B channel:", chat.title);
} else {
  if (!process.env.DATABASE_URL) throw Error("DATABASE_URL required");
  const db = neon(process.env.DATABASE_URL);
  const argument = process.argv.find((arg) => arg.startsWith("--event="));
  if (!argument && !process.argv.includes("--pending"))
    throw Error("Use --pending, --event=<id> or --test");
  const id = argument ? Number(argument.slice(8)) : null;
  if (id !== null && (!Number.isSafeInteger(id) || id < 1))
    throw Error("Invalid event ID");
  const rows = await db.query(
    "select id from b2b_notifications where sent_at is null and ($1::integer is null or id=$1) order by id limit 100",
    [id],
  );
  for (const row of rows) {
    await deliverNotification(
      row.id,
      (text, params) => db.query(text, params),
      token,
      chatId,
    );
    console.log("Processed B2B notification", row.id);
  }
}

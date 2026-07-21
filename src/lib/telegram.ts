type Brand = "kaja" | "hexenwerk" | "virginia";
type EntityType = "update" | "task" | "events" | "catalogue" | "merch" | "information" | "attachment";
type Action = "created" | "edited" | "updated" | "deleted" | "uploaded" | "commented" | "comment_deleted" | "image_uploaded" | "image_deleted";

const verbs: Record<Action, string> = {
  created: "a creat",
  edited: "a editat",
  updated: "a actualizat",
  deleted: "a șters",
  uploaded: "a încărcat",
  commented: "a comentat la",
  comment_deleted: "a șters un comentariu la",
  image_uploaded: "a adăugat o imagine la",
  image_deleted: "a șters o imagine din",
};

function entityLabel(entityType: EntityType, catalogueGroup?: string) {
  if (entityType === "update") return "Actualizarea";
  if (entityType === "task") return "Sarcina";
  if (entityType === "events") return "Evenimentul";
  if (entityType === "merch") return "produsul Merch";
  if (entityType === "information") return "Informația";
  if (entityType === "attachment") return "PDF-ul";
  if (catalogueGroup === "ideas") return "Ideea";
  if (catalogueGroup === "upcoming") return "produsul din În curând";
  return "produsul din Catalog activ";
}

export async function notifyTelegram({ memberName, action, entityType, title, brand, catalogueGroup }: { memberName: string; action: Action; entityType: EntityType; title: string; brand: Brand; catalogueGroup?: string | null }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const text = `${memberName} ${verbs[action]} ${entityLabel(entityType, catalogueGroup ?? undefined)} „${title}” · ${brand.toUpperCase()}`;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    if (!response.ok) console.error("Telegram notification failed", response.status);
  } catch (error) {
    console.error("Telegram notification failed", error);
  }
}

import type { PublicLanguage } from "../public-language";
const errors = {
  unauthorized: ["Acces neautorizat.", "Доступ запрещён."],
  expired: ["Contactează-ne la 076922600 pe Telegram pentru suport tehnic.", "Ссылка доступа устарела. По вопросам поддержки пишите в Telegram: 076922600."],
  conflict: ["Comanda sau datele au fost actualizate între timp. Reîncarcă pagina și verifică starea curentă.", "Заказ или данные были изменены. Обновите страницу и проверьте актуальный статус."],
  invalid: ["Verifică datele introduse. Completează toate câmpurile și selectează cantități valide.", "Проверьте данные. Заполните все поля и укажите допустимое количество товаров."],
  quantity: ["Cantitatea totală este prea mare.", "Общее количество слишком велико."],
  unavailable: ["Produs indisponibil.", "Товар недоступен."],
  stock: ["Stoc insuficient pentru cantitatea solicitată. Reîncarcă stocul și verifică produsele.", "Недостаточно товара для указанного количества. Обновите остатки и проверьте товары."],
  network: ["Conexiunea a eșuat. Verifică internetul și încearcă din nou.", "Ошибка соединения. Проверьте интернет и попробуйте снова."],
  failed: ["Operația nu a reușit. Încearcă din nou; datele introduse au fost păstrate.", "Не удалось выполнить действие. Попробуйте снова; введённые данные сохранены."],
} as const;
export function b2bErrorCode(message: string, status: number) {
  if (message.startsWith("Comanda sau datele")) return "conflict";
  if (message.startsWith("Verifică datele")) return "invalid";
  if (message.startsWith("Cantitatea totală")) return "quantity";
  if (message.startsWith("Stoc insuficient") || message.startsWith("STWY are")) return "stock";
  if (message === "Produs indisponibil.") return "unavailable";
  if (status === 401) return "expired";
  if (status === 403) return "unauthorized";
  return "failed";
}
export class B2BRequestError extends Error {
  constructor(message: string, public code: string) { super(message); }
}
export function requestError(error: unknown, fallback: string) {
  return error instanceof B2BRequestError ? `@b2b:${error.code}` : error instanceof Error ? error.message : fallback;
}
export function translatedError(message: string, language: PublicLanguage) {
  const code = message.startsWith("@b2b:") ? message.slice(5) : null;
  if (code && code in errors) return errors[code as keyof typeof errors][language === "ru" ? 1 : 0];
  return message;
}

export function isStockError(error: unknown): boolean {
  let current = error;
  for (let i=0;i<8 && current && typeof current === "object";i++) {
    if ("message" in current && typeof current.message === "string" && current.message.includes("B2B_STOCK_INSUFFICIENT")) return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

export type PublicLanguage = "ro" | "ru";
export const LANGUAGE_COOKIE = "kaja_language";
export const publicLanguage = (value?: string): PublicLanguage => value === "ru" ? "ru" : "ro";
export const normalizeSearch = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const flavors: Record<string, string> = {
  "Gheață": "Лёд", "Bomboane Lămâie": "Лимонные конфеты", "Ceai Verde": "Зелёный чай",
  "Căpșună": "Клубника", "Aperol": "Апероль", "Guava": "Гуава", "Tartă de lămâie": "Лимонный тарт",
  "Aloe Vera": "Алоэ вера", "Ciocolată": "Шоколад", "Miere de tei": "Липовый мёд", "Brownie": "Брауни",
  "Lavandă": "Лаванда", "Măr Verde": "Зелёное яблоко", "Pomelo": "Помело", "Kiwi Smoothie": "Смузи из киви",
  "Apricot Jam": "Абрикосовый джем", "Cafea": "Кофе", "Dovleac": "Тыква", "Pară": "Груша",
  "Mango Lassi": "Манго ласси", "Lapte Scorțișoară": "Молоко с корицей", "Iced Wine (Muscat)": "Ледяное вино (Мускат)",
  "Vinariță (Woodruff)": "Ясменник (Woodruff)", "Cheesecake": "Чизкейк", "Vanilie": "Ваниль",
};
const russianFlavors = new Map(Object.entries(flavors).map(([ro, ru]) => [normalizeSearch(ro), ru]));
export function translatedFlavor(flavor: string, language: PublicLanguage) {
  return language === "ru" ? russianFlavors.get(normalizeSearch(flavor)) ?? flavor : flavor;
}
export function matchesProduct(product: { name: string; flavor: string }, search: string) {
  return normalizeSearch(`${product.name} ${product.flavor} ${translatedFlavor(product.flavor, "ru")}`).includes(normalizeSearch(search));
}
export const russianText: Record<string, string> = {
  "Istoric": "История", "Cashback:": "Кешбэк:", "Cashback total:": "Общий кешбэк:", "Comandă nouă": "Новый заказ", "Istoric comenzi": "История заказов", "Istoricul comenzilor": "История заказов",
  "Schimbă locația": "Сменить заведение", "Navigare comenzi": "Навигация заказов", "Datele localului": "Данные заведения",
  "CASHBACK": "КЕШБЭК", "CASHBACK TOTAL": "ОБЩИЙ КЕШБЭК", "Modifică comanda": "Изменить заказ",
  "Caută după denumire sau gust": "Поиск по названию или вкусу", "Caută după denumire sau gust…": "Поиск по названию или вкусу…",
  "Nu există produse care corespund căutării.": "По вашему запросу ничего не найдено.", "În stoc": "В наличии",
  "Stoc limitat": "Осталось мало", "Stoc epuizat": "Нет в наличии", "Scade": "Уменьшить", "Adaugă": "Добавить", "Cantitate": "Количество",
  "Verifică": "Проверить", "modificările": "изменения", "comanda": "заказ", "buc.": "шт.", "buc. ·": "шт. ·",
  "Confirmă comanda": "Подтвердите заказ", "Produse selectate": "Выбранные товары", "Produsele comenzii": "Товары заказа",
  "Total": "Итого", "Se trimite…": "Отправка…", "Salvează modificările": "Сохранить изменения", "Plasează comanda": "Оформить заказ",
  "Nu există comenzi încă.": "Заказов пока нет.", "Nu există comenzi pentru perioada selectată.": "За выбранный период заказов нет.",
  "Plasată": "Оформлен", "Confirmată": "Подтверждён", "Achitată": "Оплачен", "Deschide comanda #": "Открыть заказ №",
  "Plasată de": "Оформил:", "Produse și detalii": "Товары и подробности", "Catalog": "Каталог",
  "Caută produse pentru comandă": "Поиск товаров для заказа", "Catalog pentru modificare": "Каталог для изменения заказа",
  "Nu există produse potrivite.": "Подходящих товаров нет.", "Adaugă cel puțin un produs pentru a salva comanda.": "Добавьте хотя бы один товар, чтобы сохранить заказ.",
  "Cashback acordat:": "Начисленный кешбэк:", "Reîncarcă detaliile": "Обновить данные", "Verifică modificările": "Проверить изменения",
  "Înapoi la modificare": "Вернуться к изменениям", "Se salvează…": "Сохранение…", "Înapoi": "Назад", "Închide dialogul": "Закрыть окно",
  "Accesul la local nu mai este disponibil. Redeschide linkul de acces.": "Доступ к заведению недоступен. Откройте ссылку доступа заново.",
  "Comanda a fost actualizată între timp. Selecția ta este păstrată.": "Заказ был изменён. Ваш выбор сохранён.",
  "Comanda a fost actualizată între timp. Revino la detalii pentru a verifica starea curentă.": "Заказ был изменён. Вернитесь к подробностям, чтобы проверить актуальный статус.",
  "Link invalid sau expirat": "Ссылка недействительна или устарела",
  "Contactează-ne la 076922600 pe Telegram pentru suport tehnic.": "По вопросам технической поддержки пишите в Telegram: 076922600.",
  "Trimiterea nu a reușit.": "Не удалось отправить заказ.", "Salvarea nu a reușit.": "Не удалось сохранить изменения.",
};
export function publicText(language: PublicLanguage, text: string): string {
  if (language === "ro") return text;
  const key = text.trim();
  if (russianText[key]) return text.replace(key, russianText[key]);
  const patterns: [RegExp, string][] = [
    [/^Comanda #(\d+) a fost plasată\.$/, "Заказ №$1 оформлен."], [/^Comanda #(\d+) a fost actualizată\.$/, "Заказ №$1 обновлён."],
    [/^Comanda #(\d+)$/, "Заказ №$1"], [/^Modifică comanda #(\d+)$/, "Изменить заказ №$1"],
    [/^Scade (.+)$/, "Уменьшить $1"], [/^Adaugă (.+)$/, "Добавить $1"], [/^Cantitate (.+)$/, "Количество $1"],
  ];
  for (const [pattern, replacement] of patterns) if (pattern.test(text)) return text.replace(pattern, replacement);
  return text;
}

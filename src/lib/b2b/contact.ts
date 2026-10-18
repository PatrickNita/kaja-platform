/** Contact identity used for access grouping, never for order ownership. */
export function contactKey(name: string, phone: string) {
  const normalizedName = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00373") && digits.length === 13)
    digits = digits.slice(2);
  if (digits.startsWith("373") && digits.length === 11)
    digits = "0" + digits.slice(3);
  return normalizedName + "|" + digits;
}

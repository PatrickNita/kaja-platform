/** A list excerpt only; the original message remains available in the dialog. */
export function feedbackPreview(body: string, limit: 100 | 200): string {
  const paragraphs = body.split(/\r\n|[\n\r\u2028\u2029]/u).map(part => part.trim()).filter(Boolean);
  const characters = Array.from(paragraphs[0] ?? "");
  const truncated = characters.length > limit || paragraphs.length > 1;
  return characters.slice(0, limit).join("") + (truncated ? "..." : "");
}

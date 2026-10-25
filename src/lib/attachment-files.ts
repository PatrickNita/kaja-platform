export const attachmentTypes = { pdf: "application/pdf", png: "image/png" } as const;
export const maxAttachmentSize = 25 * 1024 * 1024;

export function attachmentContentType(filename: string): string | null {
  if (typeof filename !== "string" || !filename || filename.length > 255 || /[\\/\r\n\0]/.test(filename)) return null;
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension === "png" || extension === "pdf" ? attachmentTypes[extension] : null;
}

export function validAttachmentSignature(bytes: Uint8Array, contentType: string) {
  const signature = contentType === "image/png" ? [137, 80, 78, 71, 13, 10, 26, 10] : contentType === "application/pdf" ? [37, 80, 68, 70, 45] : [];
  return signature.length > 0 && signature.every((value, index) => bytes[index] === value);
}

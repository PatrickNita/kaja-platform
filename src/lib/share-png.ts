type FileShareApi = {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
};

export async function sharePng(file: File, api: FileShareApi): Promise<"opened" | "cancelled" | "unsupported"> {
  if (typeof api.share !== "function" || typeof api.canShare !== "function" || !api.canShare({ files: [file] })) return "unsupported";
  try {
    // Call from the click handler, after the file has already been prepared.
    await api.share({ files: [file] });
    return "opened";
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return "cancelled";
    throw error;
  }
}

export async function prepareSharePng(id: number, filename: string, signal: AbortSignal, request = fetch): Promise<File> {
  const response = await request(`/api/attachments/${id}?preview=1`, { credentials: "same-origin", cache: "no-store", signal });
  if (!response.ok) throw new Error("Imaginea nu poate fi încărcată.");
  const blob = await response.blob();
  if (blob.type !== "image/png" || blob.size === 0 || blob.size > 25 * 1024 * 1024) throw new Error("Imagine PNG indisponibilă.");
  return new File([blob], filename, { type: "image/png" });
}

"use client";
export async function markSeen(data: { type: "order"; id: number; version: number } | { type: "feedback"; ids: number[] }) {
  try {
    const response = await fetch("/api/member-seen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), keepalive: true });
    if (response.ok) window.dispatchEvent(new Event("member-seen-updated"));
    return response.ok;
  } catch { return false; }
}

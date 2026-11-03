"use client";
import type { DashboardBrand } from "../lib/member-dashboard";
export async function markSeen(data: { type: "order"; id: number; version: number } | { type: "feedback"; ids: number[] } | { type: "dashboard"; kind: "orders" | "feedback"; brand: DashboardBrand }) {
  try {
    const response = await fetch("/api/member-seen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), keepalive: true });
    // Dashboard actions navigate after saving; refreshing the departing page can
    // race with that navigation. Its counts are fetched again when returning.
    if (response.ok && data.type !== "dashboard") window.dispatchEvent(new Event("member-seen-updated"));
    return response.ok;
  } catch { return false; }
}

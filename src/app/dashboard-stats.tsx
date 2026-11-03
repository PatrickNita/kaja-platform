"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NavigationIcon } from "./navigation-icon";
import { markSeen } from "./member-seen";
import type { DashboardBrand } from "../lib/member-dashboard";
export function DashboardStats({ initial, brand }: { initial: { orders: number; feedback: number }; brand: DashboardBrand }) {
  const [counts, setCounts] = useState(initial), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  const router = useRouter();
  const refreshed = useRef("");
  const saving = useRef(false);
  const [pending, setPending] = useState<"orders" | "feedback" | null>(null);
  const [seenError, setSeenError] = useState<"orders" | "feedback" | null>(null);
  async function openHistory(kind: "orders" | "feedback") {
    if (saving.current) return;
    saving.current = true; setPending(kind); setSeenError(null);
    try {
      const ok = await markSeen({ type: "dashboard", kind, brand });
      if (!ok) { setSeenError(kind); return; }
      router.push(kind === "orders" ? `/b2b?tab=history&brand=${brand}` : `/feedback?tab=history&brand=${brand}`);
    } finally { saving.current = false; setPending(null); }
  }
  useEffect(() => {
    let pending: AbortController | undefined;
    const refresh = async () => {
      pending?.abort(); const current = new AbortController(); pending = current;
      try {
        const response = await fetch(`/api/member-dashboard?brand=${brand}`, { cache: "no-store", signal: current.signal });
        if (!response.ok) throw Error(); const data = await response.json();
        if (!current.signal.aborted) {
          setCounts(data); setError(false);
          const revision = `${brand}:${data.orders}:${data.feedback}`;
          if ((data.orders !== initial.orders || data.feedback !== initial.feedback) && refreshed.current !== revision) { refreshed.current = revision; router.refresh(); }
        }
      } catch { if (!current.signal.aborted) setError(true); }
    };
    void refresh(); window.addEventListener("focus", refresh); window.addEventListener("pageshow", refresh); window.addEventListener("member-seen-updated", refresh);
    return () => { pending?.abort(); window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); window.removeEventListener("member-seen-updated", refresh); };
  }, [brand, retry, initial.orders, initial.feedback, router]);
  return <><div className="dashboard-stats">
    <button type="button" className="dashboard-stat" disabled={pending !== null} aria-busy={pending === "orders"} onClick={() => void openHistory("orders")}><span className="icon-tile"><NavigationIcon name="cart" /></span><span><span>Comenzi noi</span><strong>{counts.orders}</strong></span></button>
    <button type="button" className="dashboard-stat" disabled={pending !== null} aria-busy={pending === "feedback"} onClick={() => void openHistory("feedback")}><span className="icon-tile"><NavigationIcon name="feedback" /></span><span><span>Feedback nou</span><strong>{counts.feedback}</strong></span></button>
  </div>{seenError && <div className="read-state-error" role="alert">Nu s-au putut marca drept văzute. <button type="button" className="text-button" disabled={pending !== null} onClick={() => void openHistory(seenError)}>Reîncearcă</button></div>}{error && <div className="read-state-error" role="status">Contoarele nu au putut fi actualizate. <button className="text-button" onClick={() => setRetry(n => n + 1)}>Reîncearcă</button></div>}</>;
}

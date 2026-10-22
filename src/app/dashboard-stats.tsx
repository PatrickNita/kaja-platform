"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NavigationIcon } from "./navigation-icon";
export function DashboardStats({ initial, brand }: { initial: { orders: number; feedback: number }; brand: string }) {
  const [counts, setCounts] = useState(initial), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  const router = useRouter();
  const refreshed = useRef("");
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
    <Link className="dashboard-stat" href={`/b2b?tab=history&unread=1&brand=${brand}`}><span className="icon-tile"><NavigationIcon name="cart" /></span><span><span>Comenzi noi</span><strong>{counts.orders}</strong></span></Link>
    <Link className="dashboard-stat" href={`/feedback?tab=history&brand=${brand}`}><span className="icon-tile"><NavigationIcon name="feedback" /></span><span><span>Feedback nou</span><strong>{counts.feedback}</strong></span></Link>
  </div>{error && <div className="read-state-error" role="status">Contoarele nu au putut fi actualizate. <button className="text-button" onClick={() => setRetry(n => n + 1)}>Reîncearcă</button></div>}</>;
}

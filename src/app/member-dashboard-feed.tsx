"use client";
import Link from "next/link";
import { useState } from "react";
import type { DashboardEntry } from "../lib/member-dashboard";
import { NavigationIcon } from "./navigation-icon";
export function DashboardFeed({ entries, paginated }: { entries: DashboardEntry[]; paginated: boolean }) {
  const [limit, setLimit] = useState(50);
  return <><div className={paginated ? "premium-list" : "premium-list dashboard-feed-summary"}>{entries.slice(0, paginated ? limit : 6).map(e => <Link key={e.key} href={e.href} className={`premium-row${e.unread ? " is-unread" : ""}`}><span className="icon-tile"><NavigationIcon name={e.kind === "order" ? "cart" : e.kind === "feedback" ? "feedback" : "person"} /></span><span className="premium-row-content"><strong>{e.title}{e.unread && <span className="unread-dot" aria-label="Nevăzut" />}</strong><small>{e.context} · {new Intl.DateTimeFormat("ro-RO", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Chisinau" }).format(new Date(e.date))}</small>{(e.excerpt || !paginated) && <p className="row-excerpt">{e.excerpt || "\u00a0"}</p>}</span><NavigationIcon name="chevron" /></Link>)}{!entries.length && <p className="empty-state">Nu există actualizări pentru acest brand.</p>}</div>{paginated && limit < entries.length && <button className="button ghost" onClick={() => setLimit(n => n + 50)}>Încarcă mai multe</button>}</>;
}

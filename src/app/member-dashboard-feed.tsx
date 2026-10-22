"use client";
import Link from "next/link";
import { useState } from "react";
import type { DashboardEntry } from "../lib/member-dashboard";
import { NavigationIcon } from "./navigation-icon";
export function DashboardFeed({ entries, paginated, informational = false, emptyText = "Nu există actualizări pentru acest brand." }: {
  entries: DashboardEntry[]; paginated: boolean; informational?: boolean; emptyText?: string;
}) {
  const [limit, setLimit] = useState(50);
  return <><div className={paginated ? "premium-list" : "premium-list dashboard-feed-summary"}>{entries.slice(0, paginated ? limit : 6).map(e => {
    const content = <><span className="icon-tile"><NavigationIcon name={e.kind === "order" ? "cart" : e.kind === "feedback" ? "feedback" : "person"} /></span><span className="premium-row-content"><strong>{e.title}{e.unread && <span className="unread-dot" aria-label="Nevăzut" />}</strong><small>{e.context} · {new Intl.DateTimeFormat("ro-RO", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Chisinau" }).format(new Date(e.date))}</small>{e.excerpt && <p className="row-excerpt">{e.excerpt}</p>}</span>{!informational && <NavigationIcon name="chevron" />}</>;
    const className = `premium-row${e.unread ? " is-unread" : ""}`;
    return informational ? <div key={e.key} className={className}>{content}</div> : <Link key={e.key} href={e.href} className={className}>{content}</Link>;
  })}{!entries.length && <p className="empty-state">{emptyText}</p>}</div>{paginated && limit < entries.length && <button className="button ghost" onClick={() => setLimit(n => n + 50)}>Încarcă mai multe</button>}</>;
}

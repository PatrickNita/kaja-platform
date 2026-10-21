import Link from "next/link";
import type { ReactNode } from "react";
import type { activityData } from "./actions";
import { dashboardData, type DashboardBrand, type DashboardEntry } from "../lib/member-dashboard";
import { NavigationIcon } from "./navigation-icon";
import { DashboardStats } from "./dashboard-stats";
import { DashboardFeed } from "./member-dashboard-feed";
const brands: Record<string, string> = { kaja: "KAJA", hexenwerk: "HEXENWERK", virginia: "LUMEN" };
export async function MemberDashboard({ slug, brand, activity, filters, full }: { slug: string; brand: DashboardBrand; activity: Awaited<ReturnType<typeof activityData>>; filters: ReactNode; full: boolean }) {
  const data = await dashboardData(slug, brand, full);
  const entries: DashboardEntry[] = [...data.entries, ...activity.map(({ event, actor, targetExists, taskCompleted }) => ({
    key: `activity-${event.id}`, kind: "activity" as const, title: `${actor} ${event.summary}`, context: brands[event.brand] ?? event.brand,
    date: event.createdAt.toISOString(), href: !targetExists ? "/?view=activity&activity=all" : event.entityType === "task" ? `/?view=tasks&brand=${taskCompleted ? "all" : event.brand}&tasks=${taskCompleted ? "history" : "all"}#entry-task-${event.entityId}` : event.entityType === "attachment" ? `/?view=uploads&brand=${event.brand}#attachment-${event.entityId}` : event.entityType === "update" ? `/?view=activity&activity=all#entry-update-${event.entityId}` : `/?view=${event.entityType}&brand=${event.brand}${event.entityType === "catalogue" ? `&catalogue=${event.catalogueGroup ?? "live"}` : ""}#entry-${event.entityType}-${event.entityId}`,
  }))].sort((a, b) => +new Date(b.date) - +new Date(a.date) || b.key.localeCompare(a.key));
  const date = new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Chisinau" }).format(new Date());
  return <div className="member-dashboard">
    <div className="section-intro"><h1>{full ? "Istoric activitate" : "Activitate"}</h1><p>{date}</p></div>
    {filters}
    {!full && <DashboardStats initial={data.counts} brand={brand} />}
    <section><div className="section-heading"><h2>{full ? "Toate actualizările" : "Ultimele actualizări"}</h2><Link href={full ? `/?view=activity&brand=${brand}` : `/?view=activity&brand=${brand}&activity=all`}>{full ? "Înapoi" : "Vezi toate"}<NavigationIcon name="chevron" /></Link></div><DashboardFeed entries={full ? entries : entries.slice(0, 6)} paginated={full} /></section>
    {!full && <section><div className="section-heading"><h2>Sarcini de urmărit</h2><Link href={`/?view=tasks&tasks=mine&brand=${brand}`}>Vezi toate<NavigationIcon name="chevron" /></Link></div><div className="premium-list">{data.tasks.map(t => <Link className="premium-row" key={t.id} href={`/?view=tasks&tasks=mine&brand=${t.brand}#entry-task-${t.id}`}><span className="task-circle" /><span className="premium-row-content"><strong>{t.title}</strong><small>{brands[t.brand]} · {new Intl.DateTimeFormat("ro-RO", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Chisinau" }).format(new Date(t.date))}</small></span><NavigationIcon name="chevron" /></Link>)}{!data.tasks.length && <p className="empty-state">Nu ai sarcini de urmărit.</p>}</div></section>}
  </div>;
}

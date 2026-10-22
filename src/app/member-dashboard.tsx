import Link from "next/link";
import type { ReactNode } from "react";
import type { activityData } from "./actions";
import { dashboardData, type DashboardBrand, type DashboardEntry } from "../lib/member-dashboard";
import { NavigationIcon } from "./navigation-icon";
import { DashboardStats } from "./dashboard-stats";
import { DashboardFeed } from "./member-dashboard-feed";
const brands: Record<string, string> = { kaja: "KAJA", hexenwerk: "HEXENWERK", virginia: "LUMEN" };
export async function MemberDashboard({ slug, brand, activity, deletedActivity = [], filters, full, source }: { slug: string; brand: DashboardBrand; activity: Awaited<ReturnType<typeof activityData>>; deletedActivity?: Awaited<ReturnType<typeof activityData>>; filters: ReactNode; full: boolean; source?: "external" | "internal" | "deleted" }) {
  const data = await dashboardData(slug, brand, full);
  const internal: DashboardEntry[] = activity.map(({ event, actor, targetExists, taskCompleted }) => ({
    key: `activity-${event.id}`, kind: "activity" as const, title: `${actor} ${event.summary}`, context: brands[event.brand] ?? event.brand,
    date: event.createdAt.toISOString(), href: !targetExists ? "/?view=activity&activity=all" : event.entityType === "task" ? `/?view=tasks&brand=${taskCompleted ? "all" : event.brand}&tasks=${taskCompleted ? "history" : "all"}#entry-task-${event.entityId}` : event.entityType === "attachment" ? `/?view=uploads&brand=${event.brand}#attachment-${event.entityId}` : event.entityType === "update" ? `/?view=activity&activity=all#entry-update-${event.entityId}` : `/?view=${event.entityType}&brand=${event.brand}${event.entityType === "catalogue" ? `&catalogue=${event.catalogueGroup ?? "live"}` : ""}#entry-${event.entityType}-${event.entityId}`,
  }));
  const deletions: DashboardEntry[] = slug === "patrick" ? deletedActivity.map(({event,actor}) => ({
    key:`deleted-${event.id}`, kind:"activity", title:`${actor} ${event.summary}`, context:brands[event.brand] ?? event.brand, date:event.createdAt.toISOString(), href:"",
  })) : [];
  const sorted = (entries: DashboardEntry[]) => [...entries].sort((a, b) => +new Date(b.date) - +new Date(a.date) || b.key.localeCompare(a.key));
  const external = sorted(data.entries);
  const internalEntries = sorted(internal);
  const entries = source === "deleted" ? sorted(deletions) : source === "external" ? external : source === "internal" ? internalEntries : sorted([...external, ...internalEntries]);
  const date = new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Chisinau" }).format(new Date());
  return <div className="member-dashboard">
    <div className="section-intro"><h1>{full ? source === "deleted" ? "Șterse recent" : source === "external" ? "Actualizări externe" : source === "internal" ? "Actualizări interne" : "Istoric activitate" : "Activitate"}</h1><p>{date}</p></div>
    {filters}
    {!full && <DashboardStats initial={data.counts} brand={brand} />}
    {full ? <section data-dashboard-source={source ?? "all"}><div className="section-heading"><h2>{source === "deleted" ? "Istoricul ștergerilor" : source === "external" ? "Toate actualizările externe" : source === "internal" ? "Toate actualizările interne" : "Toate actualizările"}</h2><Link href={`/?view=activity&brand=${brand}`}>Înapoi<NavigationIcon name="chevron" /></Link></div><DashboardFeed entries={entries} paginated informational={source === "deleted"} emptyText={source === "deleted" ? "Nu există ștergeri pentru acest brand." : undefined} /></section> : <>
      <section data-dashboard-source="external"><div className="section-heading"><h2>Actualizări externe</h2><Link href={`/?view=activity&brand=${brand}&activity=external`}>Vezi toate<NavigationIcon name="chevron" /></Link></div><DashboardFeed entries={external.slice(0,6)} paginated={false} /></section>
      <section data-dashboard-source="internal"><div className="section-heading"><h2>Actualizări interne</h2><Link href={`/?view=activity&brand=${brand}&activity=internal`}>Vezi toate<NavigationIcon name="chevron" /></Link></div><DashboardFeed entries={internalEntries.slice(0,6)} paginated={false} /></section>
    </>}
    {!full && <section data-dashboard-source="tasks"><div className="section-heading"><h2>Sarcini de urmărit</h2><Link href={`/?view=tasks&tasks=mine&brand=${brand}`}>Vezi toate<NavigationIcon name="chevron" /></Link></div><div className="premium-list">{data.tasks.map(t => <Link className="premium-row" key={t.id} href={`/?view=tasks&tasks=mine&brand=${t.brand}#entry-task-${t.id}`}><span className="task-circle" /><span className="premium-row-content"><strong>{t.title}</strong><small>{brands[t.brand]} · {new Intl.DateTimeFormat("ro-RO", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Chisinau" }).format(new Date(t.date))}</small></span><NavigationIcon name="chevron" /></Link>)}{!data.tasks.length && <p className="empty-state">Nu ai sarcini de urmărit.</p>}</div></section>}
    {!full && slug === "patrick" && <section className="dashboard-deleted-section" data-dashboard-source="deleted"><div className="section-heading"><h2>Șterse recent</h2><Link href={`/?view=activity&brand=${brand}&activity=deleted`}>Vezi toate<NavigationIcon name="chevron" /></Link></div><DashboardFeed entries={sorted(deletions).slice(0,6)} paginated={false} informational emptyText="Nu există ștergeri pentru acest brand." /></section>}
  </div>;
}

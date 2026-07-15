import Image from "next/image";
import { currentMember } from "../lib/auth";
import { hasDatabase } from "../lib/db";
import { workspaceItems } from "../lib/schema";
import { createTask, createUpdate, createWorkspaceItem, deleteRecord, deleteWorkspaceItem, editUpdate, updateTask, updateWorkspaceItem, workspaceData } from "./actions";
import { WelcomeIntro } from "./welcome-intro";

export const dynamic = "force-dynamic";

const sections = [
  { key: "updates", label: "Updates" },
  { key: "tasks", label: "Tasks" },
  { key: "events", label: "Events" },
  { key: "flavors", label: "Flavors" },
  { key: "catalogue", label: "Catalogue" },
  { key: "merch", label: "Merch" },
] as const;
const catalogueGroups = [
  { key: "live", label: "Live Catalogue" },
  { key: "upcoming", label: "Upcoming" },
  { key: "ideas", label: "Ideas" },
] as const;

type Section = (typeof sections)[number]["key"];
type CatalogueGroup = (typeof catalogueGroups)[number]["key"];
type Data = NonNullable<Awaited<ReturnType<typeof workspaceData>>>;
type WorkspaceItemRow = { item: typeof workspaceItems.$inferSelect; author: string };

function date(value: Date) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Chisinau" }).format(value);
}

function WorkspaceSection({ section, title, items, catalogueGroup }: { section: string; title: string; items: WorkspaceItemRow[]; catalogueGroup?: CatalogueGroup }) {
  const itemLabel = section === "catalogue" ? "catalogue item" : title.slice(0, -1).toLowerCase();
  return <section className="panel"><div className="panel-head"><h2>{title}</h2><span className="count">{items.length} active</span></div><form action={createWorkspaceItem} className="form"><input type="hidden" name="section" value={section} />{catalogueGroup && <input type="hidden" name="catalogueGroup" value={catalogueGroup} />}<input name="title" required maxLength={160} placeholder={`${itemLabel[0]!.toUpperCase()}${itemLabel.slice(1)} title`} /><textarea name="body" required maxLength={4000} placeholder={`Describe this ${itemLabel}.`} /><button className="button">Add {itemLabel}</button></form><div className="items">{items.length === 0 ? <p className="empty">No records yet.</p> : items.map(({ item, author }) => <article key={item.id} className="item"><h3 className="item-title">{item.title}</h3><p>{item.body}</p><div className="meta"><span>Created by {author}</span><span>·</span><span>{date(item.updatedAt)}</span></div><details><summary>Edit {itemLabel}</summary><form action={updateWorkspaceItem} className="form edit-form"><input type="hidden" name="id" value={item.id} /><input type="hidden" name="section" value={section} /><input name="title" defaultValue={item.title} required maxLength={160} /><textarea name="body" defaultValue={item.body} required maxLength={4000} /><button className="button">Save changes</button></form><form action={deleteWorkspaceItem} className="edit-form"><input type="hidden" name="id" value={item.id} /><input type="hidden" name="section" value={section} /><input type="hidden" name="title" value={item.title} /><button className="button ghost danger">Delete {itemLabel}</button></form></details></article>)}</div></section>;
}

function UpdatesSection({ data }: { data: Data }) {
  return <section className="panel"><div className="panel-head"><h2>Updates</h2><span className="count">{data.updates.length} active</span></div><form action={createUpdate} className="form"><input name="title" required maxLength={160} placeholder="Update title" /><textarea name="body" required maxLength={4000} placeholder="Share what changed, what matters, or what is next." /><button className="button">Publish update</button></form><div className="items">{data.updates.map(({ update, author }) => <article key={update.id} className="item"><h3 className="item-title">{update.title}</h3><p>{update.body}</p><div className="meta"><span>Created by {author}</span><span>·</span><span>{date(update.updatedAt)}</span></div><details><summary>Edit update</summary><form action={editUpdate} className="form edit-form"><input type="hidden" name="id" value={update.id} /><input name="title" defaultValue={update.title} required maxLength={160} /><textarea name="body" defaultValue={update.body} required maxLength={4000} /><button className="button">Save changes</button></form><form action={deleteRecord} className="edit-form"><input type="hidden" name="id" value={update.id} /><input type="hidden" name="type" value="update" /><input type="hidden" name="title" value={update.title} /><button className="button ghost danger">Delete update</button></form></details></article>)}</div></section>;
}

function TasksSection({ data }: { data: Data }) {
  return <section className="panel"><div className="panel-head"><h2>Tasks</h2><span className="count">{data.tasks.length} active</span></div><form action={createTask} className="form compact"><input name="title" required maxLength={160} placeholder="Add a task" /><button className="button">Add task</button></form><div className="items">{data.tasks.length === 0 ? <p className="empty">No tasks yet. Turn work into something visible.</p> : data.tasks.map(({ task, author }) => <article key={task.id} className="item"><h3 className="item-title">{task.title}</h3><div className="meta"><span>Created by {author}</span><span>·</span><span>{date(task.updatedAt)}</span></div><details><summary>Edit task</summary><form action={updateTask} className="form edit-form"><input type="hidden" name="id" value={task.id} /><input name="title" defaultValue={task.title} required maxLength={160} /><button className="button">Save task</button></form><form action={deleteRecord} className="edit-form"><input type="hidden" name="id" value={task.id} /><input type="hidden" name="type" value="task" /><input type="hidden" name="title" value={task.title} /><button className="button ghost danger">Delete task</button></form></details></article>)}</div></section>;
}

function CatalogueSection({ data }: { data: Data }) {
  return <div className="catalogue-grid">{catalogueGroups.map((group) => <WorkspaceSection key={group.key} section="catalogue" title={group.label} catalogueGroup={group.key} items={data.workspaceItems.filter(({ item }) => item.section === "catalogue" && item.catalogueGroup === group.key)} />)}</div>;
}

export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const member = await currentMember();
  if (!member) return <main className="landing"><section className="landing-card"><Image className="logo" src="/kaja-logo.png" alt="KAJA" width={1024} height={240} priority /><p className="eyebrow">Internal member platform</p><h1>One shared view of the work.</h1><p>Use your personal KAJA link to enter the workspace. Every update, task, and change is attributed to the member who made it.</p>{!hasDatabase && <div className="setup">Database setup is pending. Add the Neon Marketplace integration in Vercel and configure <code>DATABASE_URL</code> before sharing member links.</div>}</section></main>;
  const data = await workspaceData();
  if (!data) return <main className="landing"><section className="landing-card"><Image className="logo" src="/kaja-logo.png" alt="KAJA" width={1024} height={240} priority /><h1>Database required.</h1><p>Connect Neon in the Vercel Marketplace, set DATABASE_URL, then deploy again.</p></section></main>;
  const requestedView = (await searchParams).view;
  const view: Section = sections.some((section) => section.key === requestedView) ? requestedView as Section : "tasks";
  const sectionItems = data.workspaceItems.filter(({ item }) => item.section === view);
  const content = view === "updates" ? <UpdatesSection data={data} /> : view === "tasks" ? <TasksSection data={data} /> : view === "catalogue" ? <CatalogueSection data={data} /> : <WorkspaceSection section={view} title={sections.find((section) => section.key === view)!.label} items={sectionItems} />;
  return <><WelcomeIntro memberName={member.name} memberSlug={member.slug} /><main className="workspace-shell"><header className="workspace-header"><div className="workspace-brand"><Image className="logo" src="/kaja-logo.png" alt="KAJA" width={1024} height={240} priority /><div className="identity"><span className="dot" /> {member.name}</div></div><nav className="workspace-nav" aria-label="Workspace sections">{sections.map((section) => <a key={section.key} href={`/?view=${section.key}`} aria-current={view === section.key ? "page" : undefined} className={view === section.key ? "active" : undefined}>{section.label}</a>)}</nav></header><div className="workspace-content"><div className="workspace-main">{content}</div><aside className="panel activity-panel"><div className="panel-head"><h2>Activity</h2><span className="count">Last 20 actions</span></div><div className="activity">{data.activity.length === 0 ? <p className="empty">Changes made by the team will appear here.</p> : data.activity.map(({ event, actor }) => <div className="event" key={event.id}><b>{actor}</b> {event.summary}<div className="meta">{date(event.createdAt)}</div></div>)}</div></aside></div></main></>;
}

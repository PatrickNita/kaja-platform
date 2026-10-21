import Image from "next/image";
import Link from "next/link";
import { NavigationIcon, type NavigationSection } from "./navigation-icon";

const destinations: { key: NavigationSection; label: string }[] = [
  { key: "activity", label: "Activitate" }, { key: "catalogue", label: "Catalog" },
  { key: "b2b", label: "B2B" }, { key: "feedback", label: "Feedback" },
  { key: "tasks", label: "Sarcini" }, { key: "events", label: "Evenimente" },
  { key: "merch", label: "Merch" }, { key: "information", label: "Informații" },
  { key: "uploads", label: "Încărcări" },
];

export function WorkspaceHeader({ view, memberName, brand = "all", catalogue = "live", tasks = "all" }: {
  view: NavigationSection; memberName: string; brand?: string; catalogue?: string; tasks?: string;
}) {
  return <header className="workspace-header">
    <div className="workspace-brand">
      <Link href={`/?view=activity&brand=${brand}`} className="workspace-logo-link" aria-label="KAJA — Activitate"><Image className="logo" src="/kaja-logo.png" alt="KAJA" width={1024} height={240} priority /></Link>
      <div className="identity"><span className="member-avatar" aria-hidden="true">{memberName.slice(0, 1)}</span><span>{memberName}</span></div>
    </div>
    <nav className="workspace-nav" aria-label="Secțiuni de lucru">{destinations.map(({ key, label }) => {
      const href = key === "b2b" || key === "feedback" ? `/${key}` : `/?view=${key}&brand=${brand}${key === "catalogue" ? `&catalogue=${catalogue}` : key === "tasks" ? `&tasks=${tasks}` : ""}`;
      return <Link key={key} href={href} className={view === key ? "active" : undefined} aria-current={view === key ? "page" : undefined}><NavigationIcon name={key} /><span>{label}</span></Link>;
    })}</nav>
    <p className="workspace-signature">SPAȚIU DE LUCRU</p>
  </header>;
}

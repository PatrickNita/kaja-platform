import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { currentMember } from "../../lib/auth";
import { feedbackBrand } from "../../lib/feedback-model";
import { memberFeedbackProducts } from "../../lib/feedback-server";
import { feedbackOrigin } from "../../lib/feedback-security";
import { MobileMenu } from "../mobile-menu";
import { FeedbackHistory } from "./history";
import { historyBrand } from "../../lib/feedback-history";
import { FeedbackAdmin } from "./client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "KAJA — Feedback", robots: { index: false, follow: false } };
export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ brand?: string; tab?: string }> }) {
  const member = await currentMember();
  if (!member) return <main className="landing"><p>Folosește linkul personal de membru pentru acces.</p></main>;
  const params = await searchParams;
  const brand = feedbackBrand(params.brand);
  const history = params.tab === "history";
  const links = [["activity", "ACTIVITATE"], ["tasks", "Sarcini"], ["events", "Evenimente"], ["catalogue", "Catalog"], ["merch", "Merch"], ["information", "Informații"], ["uploads", "Încărcări"]];
  return <main className="workspace-shell">
    <header className="workspace-header"><div className="workspace-brand"><Link href="/" className="workspace-logo-link"><Image className="logo" src="/kaja-logo.png" alt="KAJA" width={1024} height={240} priority /></Link><div className="identity"><span className="dot" /> {member.name}</div></div>
      <nav className="workspace-nav" aria-label="Secțiuni de lucru">{links.map(([view, label]) => <Link key={view} href={`/?view=${view}`}>{label}</Link>)}<Link href="/feedback" className="active">Feedback</Link><Link href="/b2b">B2B</Link></nav>
    </header>
    <MobileMenu brand={brand} view="feedback" catalogue="live" tasks="all" memberSlug={member.slug} />
    <div className="workspace-content">
      <nav className="catalogue-submenu filter-nav" aria-label="Vizualizare feedback">
        <Link href={`/feedback?tab=products&brand=${brand}`} className={!history ? "active" : undefined} aria-current={!history ? "page" : undefined}>Produse</Link>
        <Link href="/feedback?tab=history" className={history ? "active" : undefined} aria-current={history ? "page" : undefined}>Istoric feedback</Link>
      </nav>
      {history ? <FeedbackHistory key={historyBrand(params.brand)} brand={historyBrand(params.brand)} /> : <FeedbackAdmin products={await memberFeedbackProducts(brand)} brand={brand} origin={feedbackOrigin()} />}
    </div>
  </main>;
}

import Link from "next/link";
import type { Metadata } from "next";
import { currentMember } from "../../lib/auth";
import { feedbackBrand } from "../../lib/feedback-model";
import { memberFeedbackProducts } from "../../lib/feedback-server";
import { feedbackOrigin } from "../../lib/feedback-security";
import { WorkspaceHeader } from "../workspace-header";
import { MobileMenu } from "../mobile-menu";
import { FeedbackHistory } from "./history";
import { historyBrand } from "../../lib/feedback-history";
import { FeedbackAdmin } from "./client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "KAJA — Feedback", robots: { index: false, follow: false } };
export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ brand?: string; tab?: string; unread?: string; comment?: string }> }) {
  const member = await currentMember();
  if (!member) return <main className="landing"><p>Folosește linkul personal de membru pentru acces.</p></main>;
  const params = await searchParams;
  const brand = feedbackBrand(params.brand);
  const history = params.tab === "history";

  return <main className="workspace-shell">
    <WorkspaceHeader view="feedback" memberName={member.name} />
    <MobileMenu brand={brand} view="feedback" catalogue="live" tasks="all" memberSlug={member.slug} />
    <div className="workspace-content">
      <nav className="catalogue-submenu filter-nav" aria-label="Vizualizare feedback">
        <Link href={`/feedback?tab=products&brand=${brand}`} className={!history ? "active" : undefined} aria-current={!history ? "page" : undefined}>Produse</Link>
        <Link href="/feedback?tab=history" className={history ? "active" : undefined} aria-current={history ? "page" : undefined}>Istoric feedback</Link>
      </nav>
      {history ? <FeedbackHistory key={`${historyBrand(params.brand)}:${params.unread}`} brand={historyBrand(params.brand)} onlyUnread={params.unread === "1"} commentId={Number(params.comment) || null} /> : <FeedbackAdmin products={await memberFeedbackProducts(brand)} brand={brand} origin={feedbackOrigin()} />}
    </div>
  </main>;
}

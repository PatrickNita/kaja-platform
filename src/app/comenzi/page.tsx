import { readPublicLanguage } from "../../lib/public-language-server";
import { publicText } from "../../lib/public-language";
import type { Metadata } from "next";
import { currentLocation, loadData, SUPPORT } from "../../lib/b2b/server";
import { B2BPortal } from "../b2b/client";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "KAJA — Comenzi",
  description: "Link pentru comenzi",
  openGraph: {
    title: "KAJA — Comenzi",
    description: "Link pentru comenzi",
    siteName: "KAJA",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "KAJA — Comenzi",
    description: "Link pentru comenzi",
  },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function OrdersPage() {
  const language = await readPublicLanguage();
  const location = await currentLocation();
  if (!location)
    return (
      <main className="landing">
        <section className="landing-card">
          <h2>{publicText(language, "Link invalid sau expirat")}</h2>
          <p>{publicText(language, SUPPORT)}</p>
        </section>
      </main>
    );
  return <B2BPortal initialLanguage={language} data={await loadData(location)} />;
}

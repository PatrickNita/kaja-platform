import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { currentMember } from "../../lib/auth";
import { loadData } from "../../lib/b2b/server";
import { B2BAdmin } from "./client";
import { MobileMenu } from "../mobile-menu";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "KAJA — B2B",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function B2BPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const member = await currentMember();
  if (!member)
    return (
      <main className="landing">
        <p>Folosește linkul personal de membru pentru acces.</p>
      </main>
    );
  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <div className="workspace-brand">
          <Link href="/" className="workspace-logo-link">
            <Image
              className="logo"
              src="/kaja-logo.png"
              alt="KAJA"
              width={1024}
              height={240}
              priority
            />
          </Link>
          <div className="identity">
            <span className="dot" /> {member.name}
          </div>
        </div>
        <nav className="workspace-nav" aria-label="Secțiuni de lucru">
          <Link href="/?view=activity">ACTIVITATE</Link>
          <Link href="/?view=tasks">Sarcini</Link>
          <Link href="/?view=events">Evenimente</Link>
          <Link href="/?view=catalogue">Catalog</Link>
          <Link href="/?view=merch">Merch</Link>
          <Link href="/?view=information">Informații</Link>
          <Link href="/?view=uploads">Încărcări</Link>
          <Link href="/b2b" className="active">
            B2B
          </Link>
        </nav>
      </header>
      <MobileMenu
        brand="all"
        view="b2b"
        catalogue="live"
        tasks="all"
        memberSlug={member.slug}
      />
      <B2BAdmin
        data={await loadData()}
        memberSlug={member.slug}
        initialView={tab === "history" ? "history" : "locations"}
      />
    </main>
  );
}

import { redirect } from "next/navigation";
import { canManageOrders } from "../../lib/b2b/model";
import type { Metadata } from "next";
import { currentMember } from "../../lib/auth";
import { loadData } from "../../lib/b2b/server";
import { B2BAdmin } from "./client";
import { WorkspaceHeader } from "../workspace-header";
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
  if (tab === "stock" && !canManageOrders(member.slug)) redirect("/b2b?tab=locations");
  return (
    <main className="workspace-shell">
      <WorkspaceHeader view="b2b" memberName={member.name} />
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
        initialView={tab === "stock" ? "stock" : tab === "history" ? "history" : "locations"}
      />
    </main>
  );
}

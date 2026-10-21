import { NextResponse } from "next/server";
import { currentMember } from "../../../lib/auth";
import { dashboardCounts, type DashboardBrand } from "../../../lib/member-dashboard";
export async function GET(request: Request) {
  const member = await currentMember();
  const options = { headers: { "Cache-Control": "private, no-store" } };
  if (!member) return NextResponse.json({ error: "Acces neautorizat." }, { ...options, status: 401 });
  const brand = new URL(request.url).searchParams.get("brand") ?? "all";
  if (!["all", "kaja", "hexenwerk", "virginia"].includes(brand)) return NextResponse.json({ error: "Cerere invalidă." }, { ...options, status: 400 });
  try {
    const counts = await dashboardCounts(member.slug, brand as DashboardBrand);
    return NextResponse.json(counts, options);
  } catch { return NextResponse.json({ error: "Contoarele nu au putut fi încărcate." }, { ...options, status: 503 }); }
}

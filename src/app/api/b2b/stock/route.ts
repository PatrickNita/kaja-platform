import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { currentMember } from "../../../../lib/auth";
import { canManageOrders, type Product } from "../../../../lib/b2b/model";
import { query } from "../../../../lib/b2b/server";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function access() { const member = await currentMember(); return !member ? 401 : canManageOrders(member.slug) ? 200 : 403; }
export async function GET() {
  const status = await access();
  if (status !== 200) return json({ error: "Acces neautorizat." }, status);
  try { return json({ products: await query<Product>(sql`select id,name,flavor,grams,price,stock,stock_version as "stockVersion" from b2b_products order by position,id`) }); }
  catch { return json({ error: "Stocul nu a putut fi încărcat. Încearcă din nou." }, 503); }
}
const input = z.object({ id: z.number().int().positive().max(2147483647), quantity: z.number().int().min(0).max(1000000), version: z.number().int().positive().max(2147483647) }).strict();
export async function POST(request: Request) {
  const status = await access();
  if (status !== 200) return json({ error: "Acces neautorizat." }, status);
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Cerere neautorizată." }, 403);
  try {
    const data = input.parse(await request.json());
    const [product] = await query<Product>(sql`update b2b_products set stock=${data.quantity},stock_version=stock_version+1 where id=${data.id} and stock_version=${data.version} returning id,name,flavor,grams,price,stock,stock_version as "stockVersion"`);
    if (!product) {
      const [current] = await query<Product>(sql`select id,name,flavor,grams,price,stock,stock_version as "stockVersion" from b2b_products where id=${data.id}`);
      return current ? json({ error: "Stocul a fost modificat între timp. Preia cantitatea actuală înainte să salvezi din nou.", product: current }, 409) : json({ error: "Produsul nu mai este disponibil." }, 404);
    }
    revalidatePath("/b2b"); revalidatePath("/comenzi");
    return json({ product });
  } catch (error) {
    return json({ error: error instanceof z.ZodError || error instanceof SyntaxError ? "Introdu o cantitate între 0 și 1.000.000 de bucăți." : "Stocul nu a putut fi salvat. Cantitatea introdusă a fost păstrată." }, error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503);
  }
}

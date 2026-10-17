# KAJA Internal Platform

A Vercel-ready Next.js workspace for Patrick, Ionut, Igor, and Andrei. Members use private capability links to publish updates, manage shared tasks, and see an immutable activity trail.

## Deploy

1. Import this repository into Vercel.
2. Add the **Neon** integration from the Vercel Marketplace. It injects `DATABASE_URL`.
3. Run `pnpm db:migrate` with that environment value to create the tables.
4. Generate secrets, add them as Vercel environment variables, then redeploy:

   ```bash
   openssl rand -hex 32
   ```

   Set `SESSION_SECRET` to one generated value. Set `MEMBER_LINKS` to comma-separated entries such as `patrick:<secret>,ionut:<secret>,igor:<secret>,andrei:<secret>`.
5. Share each member’s link as `https://your-domain.vercel.app/member/<name>/<secret>`.

Never commit real secrets. A member link grants access as that person.

## B2B

The four internal members can manage locations and copy their secret links at `/b2b`.
Only Patrick and Ionut may rotate links, place orders for locations, edit orders,
or advance orders from placed to confirmed to paid. Locations use `/comenzi` with
a separate session; rotating a link invalidates its previous sessions.

Set `B2B_LINK_ENCRYPTION_KEY` to 32 random bytes encoded as 64 hex characters.
Keep this key stable and backed up in the environment: existing links are encrypted
with it. Use distinct local test credentials, never the production member sessions.

Migration `0014_b2b.sql` adds the location, product, order, line-item and cashback
tables, and the 25 KAJA products (200 g, 400 MDL). It does not alter workspace data.
For an existing installation at migration 0013, `scripts/migrate-b2b.mjs` applies
only 0014 atomically and records its hash in the existing Drizzle journal. It
requires the verified Vercel project link and `B2B_MIGRATION_DATABASE_URL`.

Run `node scripts/b2b.unit.mjs` for catalogue, permissions and token checks.
The integration suite, `node scripts/b2b.integration.mjs`, refuses non-local URLs
and databases outside `kaja_b2b_test_*`. Configure `B2B_TEST_BASE_URL`,
`B2B_TEST_DATABASE_URL`, `B2B_TEST_SESSION_SECRET` and `B2B_TEST_KEY` to match a local
Next.js test server using an isolated database with `members` and migration 0014.
The suite covers tenant isolation, role permissions, concurrent edits, duplicate
submission, single cashback credit and link/session invalidation.

Orders are immutable after payment. Cashback is a read-only accumulated balance,
credited once per paid order; no online payment or cashback redemption is offered.

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

### B2B shared contact access (0015)

Apply `scripts/migrate-b2b-access.mjs` rather than running the 0015 SQL file alone against an existing database: the runner performs the encrypted-token backfill, preserves single-location links, revokes old shared-contact links/sessions and records the migration in one transaction. Existing orders and cashback are untouched. It locks locations and verifies their snapshot before applying; rerun if concurrent edits invalidate that snapshot.

Production uses the existing Vercel encryption secret in a staged production deployment. The explicit build command is `node scripts/migrate-b2b-access-production.mjs && next build`, with build variable `B2B_APPLY_ACCESS_GROUPS=1` and `--prod --skip-domain`. Normal Git deployments retain `next build` and do not run migrations. Publish the tested commit after the staged migration/build succeeds. The runner is idempotent. Do not rotate the encryption key to perform this migration.

`node --env-file=.env.production.local scripts/b2b-access.integration.mjs` exercises real route/server code in a temporary `kaja_b2b_test_*` schema, with a generated test encryption key and transaction-local search_path. It removes only that test schema afterwards and never inserts test records in public tables.

### B2B company fields and order history (0016)

Apply `node --env-file=.env.production.local scripts/migrate-b2b-company.mjs` before deploying this revision. It adds optional company_name/idno columns and records only migration 0016, leaving existing orders, credits and contact access groups unchanged. Corporate fields are selected server-side only for Patrick/Ionut and accepted only when an authorized manager edits a venue. The presentation tests are `node scripts/b2b-presentation.unit.mjs`; the isolated database suite also checks field visibility and edit/confirmation concurrency.

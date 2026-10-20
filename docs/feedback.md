# Product feedback

Member UI: `/feedback?brand=kaja` (`hexenwerk` and `virginia` are the other brand keys; LUMEN uses `virginia`). Public form: `/feedback/[brand]/[product-slug]` (for example `/feedback/kaja/2late` or `/feedback/lumen/product`). Old `/feedback/[uuid]` URLs permanently redirect to the current friendly path.

Only explicit `product_name` and `flavor` fields are exposed publicly. Active catalogue products use the existing title editor for their product name, with an additional flavor field. UUIDs never change on edits. Deleted/upcoming/idea entries cannot receive feedback. Public routes never create member/B2B sessions or return comments.

`POST /api/feedback` accepts `product`, `body`, `requestId`, `challenge`, and an empty honeypot `website`. Same-origin checks, a signed form timestamp (2 seconds to 24 hours), 2,000-character validation, and a database-backed per-source limit protect submissions. The source key is HMAC-derived; raw IPs are not stored. Fixed windows last 10 minutes from the first accepted request. Retries with the same request ID do not duplicate comments. API errors return generic codes; the client translates RO/RU and keeps entered text.

`GET /api/feedback/[uuid]` (50 comments/page, optional `before`) and `/api/feedback/[uuid]/qr` require member authentication. QR downloads use `?download`. SVGs have a four-module white quiet zone and encode the canonical production origin. Optional `FEEDBACK_PUBLIC_ORIGIN` overrides `https://kaja-platform.vercel.app`; keep the encoded origin stable once labels are printed. Signing reuses the required `SESSION_SECRET`.

## Migration

After reviewing the intended `.vercel/project.json` and database target:

```
node --env-file=.env.production.local scripts/migrate-feedback.mjs
```

The transaction applies additive migration 0018 and fills the 25 KAJA catalogue products without modifying B2B. Existing matching entries retain IDs, media, descriptions, and comments. Repeated runs do not duplicate products or regenerate feedback UUIDs. No Telegram events are emitted by seeding or feedback.

## Tests

```
node scripts/feedback.unit.mjs
node --env-file=.env.production.local scripts/feedback.integration.mjs
```

The database integration test uses a random isolated schema and removes it in `finally`; no public-table fixtures are created.

For browser QA, start a local production build, set `FEEDBACK_QA_DIR` to an output directory and optionally `PLAYWRIGHT_MODULE_PATH` to an installed Playwright module. Then run `node --env-file=.env.production.local scripts/feedback.browser.mjs`. Chrome is required. `FEEDBACK_TEST_BASE` defaults to `http://localhost:3120`; the production hostname is allowed for explicitly requested post-deployment checks. This test creates one clearly named temporary catalogue product, submits feedback only for that product, and removes its comments and product in `finally`. It never sends Telegram messages or writes test feedback to real products.

If production secrets are protected and no authenticated member session is available, set `FEEDBACK_PUBLIC_ONLY=1` for the live public form smoke test; run the full four-role suite locally. Do not weaken authentication or add a test access endpoint for verification.

Migration 0020 adds immutable product slugs assigned by the database. A brand-scoped unique index and transactional lock handle duplicate names with `-2`, `-3`, etc. Archived entries retain their paths; product renames do not change a slug. Run `node --env-file=.env.production.local scripts/migrate-feedback-slugs.mjs` after 0019. Internal comment/QR APIs and submission identities continue using UUIDs.

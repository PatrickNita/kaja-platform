# Historical e-Factura batch

`scripts/import-efactura.mjs <XML path>` defaults to a read-only dry run. Python's standard-library XML parser is used locally; set `PYTHON_EXECUTABLE` if necessary. A pre-parsed JSON source can be used on the production build machine without Python.

This import is restricted to the ten approved invoice references, supplier IDNO, buyer IDNOs, locations, quantities and totals. It creates confirmed historical orders (58,400 MDL / 146 units), preserves current stock and stock versions, and creates neither notification events nor cashback. It never edits existing orders. Invoice metadata is retained in `location_snapshot.invoice`, with a deterministic UUIDv5 request key to prevent duplicate imports. Changed previously imported invoices are refused.

`--apply` executes the whole batch and its consistency checks in one transaction. New locations use the existing encrypted-link format. Production execution needs the server's B2B encryption key; it must not be replaced by a test key. On Vercel, execution additionally requires `VERCEL_ENV=production` and `KAJA_EFACTURA_IMPORT` equal to the source XML SHA-256. Use a one-off local deployment configuration to run the import before the normal build; no import runs during ordinary deployments. Never commit source invoices, parsed data, tokens, deployment overrides or environment files. The staging directory `.efactura-import/` is Git-ignored.

`scripts/efactura-import.integration.mjs <XML path>` runs the same transaction in a disposable schema, including retry, rollback, access separation and zero-stock tests. Existing ordinary order creation still decrements stock as before.

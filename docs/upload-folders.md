# Private upload folders

Uploads support PDF and PNG, up to 25 MB, in a single-level brand folder or at the brand root. Existing PDFs default to `application/pdf` and have no folder. Only Patrick can create/edit folders, upload files or delete files; all authenticated members can view published folders and download their files. Empty folders can be deleted. Files in draft or deleted folders are protected at the download endpoint as well as hidden in the list.

`/api/attachments/:id` downloads a file. `?preview=1` displays PNG inline; `?open=1` resolves the corresponding folder/root location for activity links. Responses containing private file content are not publicly cached.

Apply `scripts/migrate-attachment-folders.mjs` with the linked project's database environment before deploying. It checks migration order and preserves existing data. It can be run again safely.

Run `scripts/import-invitations.mjs <source-directory>` with the production database and private Blob environment for the approved 25-file November invitation batch. `--prepare-only` creates its hidden folder without uploading. The import uses deterministic blob paths and a unique live filename within a folder, so an interrupted run can resume. It verifies every uploaded file against its original SHA-256 before publishing the folder. The import does not create activity or Telegram notifications.

Checks: `node scripts/attachment-files.test.mjs` validates permissions, signatures and protected delivery; `scripts/attachment-folders.integration.mjs` uses a temporary isolated schema to test migration compatibility and retry uniqueness. `scripts/attachment-folders.browser.mjs` performs read-only browser checks at 320/390/768/1440 px for all member roles, PNG downloads and anonymous rejection. Set `PLAYWRIGHT_MODULE_PATH`, `UPLOAD_QA_DIR`, and optionally `UPLOAD_QA_BASE` / `UPLOAD_QA_SOURCE`. It never submits a valid upload or modifies production data.

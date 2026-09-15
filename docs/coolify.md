# trtMail on Coolify

This version runs as a Node.js application. No Cloudflare Worker, D1 database ID, CF_TOKEN or CF_EMAIL_WORKER_NAME is required. Existing Cloudflare deployment files are legacy; use the Dockerfile.

## Deploy

1. Add the `naimbic/trtMail` repository to Coolify (the Coolify changes must first be committed and pushed).
2. Choose **Dockerfile** as the build pack, repository root as base directory, and `Dockerfile` as its path. Expose port **3000**.
3. Set domain **https://mail.trtcrm.com**. Point its DNS to the Coolify server.
4. Add a **persistent volume mounted at /data**, writable by UID/GID **1000**. Use one application replica and one local volume, never a shared network SQLite volume. The included supervisor starts one web process and one mail worker.
5. Copy the variable names from `.env.coolify.example` into Coolify runtime variables. Set `ADMIN_EMAIL`, a unique `ADMIN_PASSWORD` (at least 16 characters), and `MAIL_ADDRESS=hello@trtmaroc.com`. No bootstrap password is embedded in the image. Existing administrator credentials are never reset on restart. Remove ADMIN_PASSWORD after the first successful initialization if desired.
6. Enter your Ubuntu mailbox credentials as secrets. Verified host: `mail.trtdigital.eu`; SMTP port `587` with STARTTLS, IMAP port `993` with TLS. Username is normally `hello@trtmaroc.com`; confirm it matches your server account. This is a mail client application, not an SMTP receiving server: `hello@trtmaroc.com` must already exist at your provider. The domain can differ from the app website. Do not change the email domain's MX records just to deploy the web app.
7. Deploy, then sign in. `/setup` redirects to `/login` after initialization. The admin page shows SMTP/IMAP configuration and last sync status.

Coolify runs the Dockerfile build; do not use the old `npm run deploy` Cloudflare command. Health check: `/api/health`.

## Mail behaviour

- The configured `MAIL_ADDRESS` is synchronized from `IMAP_FOLDER` (default INBOX), every 30 seconds by default. This first version synchronizes **one provider mailbox per installation**; app-local additional mailboxes do not automatically provision or connect provider accounts.
- By default only messages arriving after the first successful IMAP connection are imported. Set `IMAP_INITIAL_LIMIT=50` before that connection to include up to 50 recent UIDs (maximum 100). Manual IMAP import remains available for history/folders.
- Source mailbox messages are read with BODY.PEEK and a read-only folder lock. They are never deleted or marked read on the provider. Local read/archive/trash actions do not synchronize back to the provider.
- UIDVALIDITY and UID checkpoints are persisted. Incoming MIME and a durable processing job are saved before advancing the cursor. Jobs retry up to five times with backoff. Failed jobs appear in `/api/server-status` for admins.
- Incoming message size limit is 25 MB. An oversized message pauses sync instead of silently skipping it; review and move it at the provider before resuming.
- SMTP sends require an allowed sender from `SMTP_ALLOWED_FROM` (comma separated). IMAP import hosts must match `IMAP_ALLOWED_HOSTS` (defaults to IMAP_HOST). SMTP uses STARTTLS on port 587, or implicit TLS with SMTP_SECURE=true on port 465. IMAP defaults to TLS on 993.
- The inbox refreshes every 15 seconds while visible. Browser push/WebSocket notifications are not enabled in this version.
- Existing roles, mailbox access checks, API keys, message templates, contacts, attachments, calendar, routing filters and CRM lead feed remain in place. Existing licensing conditions remain unchanged.
- Account email forwarding is configured at your provider in this version. No Cloudflare forwarding rules or DNS changes are performed by the application.
- SMTP submissions are not blindly retried: a timeout can occur after a provider accepted mail. Check Sent/provider delivery logs before resending.

## Persistence and backups

`/data/mailflare.sqlite` stores the existing application schema, `/data/objects` stores raw messages, attachments, avatars and database exports. Internal jobs and IMAP checkpoints use internal SQLite tables.

Automatic migrations run on startup with a transaction and checksum for each migration. Take a full volume backup before upgrades. Use Coolify backups or a stopped-volume snapshot that includes SQLite and all object files. Never back up only the SQLite file while WAL writes are active.

The in-app Backups screen supports scheduled/manual database exports and atomic database restores. Those JSON exports do **not** contain object-file bytes or IMAP checkpoints; a complete disaster-recovery backup must include the full /data volume. Stop the worker before a database restore and reconcile its checkpoints before resuming.

Do not copy the local Cloudflare demo database into production. If there is existing Cloudflare mail data, plan an explicit database and object migration first.

## Local development and checks

Use Node 24 (minimum 22.13). Set DATA_DIR to a private persistent directory and supply ADMIN_EMAIL, ADMIN_PASSWORD and MAIL_ADDRESS via your local environment. Run `npm run server:init`, then `npm run dev:local`; run `npm run server:worker` in another terminal when provider settings are configured. Dev URL: http://127.0.0.1:3113.

Run `npm run typecheck`, `npm run test:server` and `npm run build`. Tests use isolated loopback SMTP/IMAP fixtures and temporary data; no real emails are sent.

The pre-conversion source backup is `.data/backups/before-coolify.tar.gz` (git-ignored). Real credentials were excluded. Existing `.dev.vars` files and Cloudflare local data were left untouched; the Node server does not read them.

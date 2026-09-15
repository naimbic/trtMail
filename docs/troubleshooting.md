# trtMail troubleshooting

## Container exits on first startup

Set ADMIN_EMAIL, ADMIN_PASSWORD (at least 16 characters), and MAIL_ADDRESS. Mount writable persistent storage at /data. See [Coolify setup](coolify.md).

## Incoming mail is missing

Confirm IMAP_HOST=mail.trtdigital.eu, IMAP_PORT=993, IMAP_SECURE=true and the mailbox credentials. The admin page shows the last sync result. Initial synchronization defaults to new arrivals only; use manual import for older mail.

## Outgoing mail fails

Confirm SMTP_HOST=mail.trtdigital.eu, SMTP_PORT=587, SMTP_SECURE=false, SMTP_USER and SMTP_PASSWORD. The FROM address must be present in SMTP_ALLOWED_FROM. Never resend blindly after a timeout: first check your provider's delivery logs.

## Cloudflare configuration errors

This version deploys with the repository Dockerfile on Coolify. Cloudflare Worker names, D1 IDs and CF_TOKEN are not required. Select the Dockerfile build pack and expose port 3000.

## Data after upgrades

Always reuse the /data volume. The legacy mailflare.sqlite filename, backup format and browser storage keys remain compatible. Startup applies the additive trtMail branding migration without rewriting custom names or existing schema migrations.

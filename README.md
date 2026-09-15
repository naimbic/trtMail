# trtMail

Private email workspace for TRT Digital, hosted on your own server through Coolify.

- Web app: `https://mail.trtcrm.com`
- Mailbox: `hello@trtmaroc.com`
- Mail server: `mail.trtdigital.eu` — SMTP 587 with STARTTLS, IMAP 993 with TLS

## Deploy with Coolify

Use the **Dockerfile** build pack, expose port **3000**, and mount a persistent volume at **/data**. Add the runtime variables from [.env.coolify.example](.env.coolify.example). Follow the [deployment guide](docs/coolify.md) for first-run credentials, mail connections, persistence and backups.

No Cloudflare Worker, D1 ID or Cloudflare API token is needed for this version. Existing email-provider MX records stay in place.

## Features

Inbox, compose and attachments, contacts, calendar, folders, routing filters, API keys, access-controlled mailboxes, backups and CRM lead intake. SMTP and IMAP connect your existing email server. The background worker syncs one provider inbox per installation; other folders can be imported manually.

## Development

Node 24 recommended. Configure private environment variables, then:

```sh
npm ci
npm run server:init
npm run dev:local
# Separate terminal, using the same environment:
npm run server:worker
```

Checks: `npm run typecheck`, `npm run test:server`, `npm run build`.

## Attribution and license

trtMail is an internal adaptation of Mailflare by Hieu Nguyen. The original [LICENSE](LICENSE), copyright, attribution notices and entitlement checks remain intact. The trtMail name and artwork identify TRT Digital's installation; they do not replace the upstream software license or grant redistribution/SaaS rights.

Legacy storage identifiers are retained for compatibility with existing databases, sessions and backups. Use the Coolify guide rather than the historical Cloudflare deployment configuration.

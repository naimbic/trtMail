# API and integrations

trtMail exposes APIs for domain management and sending email. Authentication and mailbox permissions still apply to these routes.

## Domain management

Adding or removing a domain from trtMail also updates Cloudflare Email Routing and sending resources.

| trtMail route | Purpose |
| --- | --- |
| `GET /api/domains` | List connected domains |
| `POST /api/domains` | Connect a domain and configure Cloudflare |
| `GET /api/domains/[id]` | Get a connected domain |
| `DELETE /api/domains/[id]` | Remove a domain and clean up its Cloudflare resources |
| `GET /api/domains/[id]/dns` | View its routing and sending DNS status |

The hostname must be the apex of a zone available to the configured Cloudflare credentials, or a subdomain of that zone. Creating a mailbox also creates the Cloudflare Email Routing rule that delivers its address to `CF_EMAIL_WORKER_NAME`.

## Sending email

Send email through `POST /api/v1/send`. Attachments are optional and use Base64-encoded content:

```json
{
  "from": "support@example.com",
  "to": "user@example.net",
  "subject": "Report",
  "text": "Attached.",
  "attachments": [
    {
      "filename": "report.pdf",
      "type": "application/pdf",
      "contentBase64": "<base64 data>"
    }
  ]
}
```

The dashboard composer accepts up to 10 attachments, with a 10 MB limit per file and a 20 MB combined limit. Attachment metadata is stored in D1 and file content is stored in R2. Downloads require access to the mailbox containing the message.

## Real-time updates

trtMail uses a Durable Object WebSocket hub to notify connected users after an inbound message is stored. Mailbox owners, the domain administrator, and delegated users receive events for mailboxes they can access.

The `REALTIME` binding and its migration are declared in `wrangler.jsonc`. When a WebSocket is temporarily unavailable, the app retries the connection and uses a slower refresh until it recovers.

## CRM service-request intake

`GET /api/v1/lead-intake?mailbox=lead%40trtdigital.ma&since=UNIX_SECONDS&limit=50`
requires a bearer API key with `read` scope and access to the exact mailbox. It returns inbound bodies only for that mailbox, including spam/trash status for downstream filtering. No mail is sent or marked read. Clients follow `nextCursor` while `hasMore` is true, committing the cursor only after CRM acknowledgement. A 60-second settling interval avoids paging through messages still being inserted. For late imports, replay from an earlier `since`; receivers must deduplicate message IDs. Attachment data and raw R2 keys are not exported.

The feed bounds text to 20,000 characters and HTML fallback to 40,000 characters per message. Full originals remain in trtMail. The CRM bridge stores a bounded plain-text excerpt and an inbox link.

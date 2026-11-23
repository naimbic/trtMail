# Mail tracking (received / opened / clicked)

Every HTML mail sent through trtMail (compose, API, calendar invitations) is tracked unless tracking is switched off in **Settings → Tracking** (administrators) or the sender passes `"track": false` to `/api/send` / `/api/v1/send`. Plain-text mails are never touched.

## Set-up
- `APP_URL` must be the public https address of the site (for example `https://mail.trtcrm.com`). Tracking links and the open picture point there. Without it, mails are sent untouched.
- Public routes, no sign-in, rate limited: `/t/o/<token>.gif` (open picture) and `/t/c/<token>/<link>` (click redirect).

## How it works
- **Sent**: the SMTP response of the outgoing server is stored (`delivery_status = sent`).
- **Received**: set only with proof: an open, a click, or a success delivery report (the server is asked for DSN reports when it supports them).
- **Bounced**: bounce / delivery-report messages (RFC 3464) that arrive in the connected IMAP mailbox are matched to the sent mail through its Message-ID.
- **Opened**: a 1x1 image with a random per-mail token. **Clicked**: http(s) links are rewritten to the redirect route; the destination is read from the links stored for that mail, never from the request.
- Not tracked: plain-text mails, unsubscribe links, links in the signature block, mailto:/tel: links, and links whose visible text is itself a URL.
- Ignored: hits within 15 s (open) / 10 s (click) of sending, user agents of known scanners, repeated image loads within 3 s, and a burst that hits every link of a mail within 6 s.
- Unknown tokens get the same answer as known ones (pixel) or the same 404 (links).

## What cannot be known
Inbox vs spam placement; whether a server that never sends a bounce delivered the mail; real opens (Apple Mail pre-loads images, Gmail proxies them, some apps block them). A click is the reliable signal.

## Data
`messages` gets `tracking_token`, `sent_at`, `delivery_status`, `delivery_detail`, `delivered_at`, `bounced_at`, `open_count`, `first/last_opened_at`, `click_count`, `first/last_clicked_at`. Details live in `message_tracking_links` and `message_tracking_events` (included in backups). Webhook events: `message.opened`, `message.clicked`, `message.bounced`.

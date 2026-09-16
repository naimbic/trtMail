/**
 * Branded HTML wrapper for system emails (reminders, notifications).
 * Email-client-safe: tables + inline styles only. Self-contained, no dependency.
 */

function esc(v: unknown): string {
	return String(v ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function renderSystemEmail(input: {
	heading: string;
	badge?: string;
	bodyHtml: string;
	footerNote?: string;
	primary?: string;
	accent?: string;
}): string {
	const primary = input.primary ?? "#2563eb";
	const accent = input.accent ?? "#38bdf8";
	const badge = input.badge
		? `<span style="display:inline-block;margin-top:10px;padding:4px 12px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);border-radius:999px;color:#fff;font-size:12px;font-weight:600;">${esc(input.badge)}</span>`
		: "";
	return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f4f6f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(16,24,40,.06);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="background:linear-gradient(135deg,${primary} 0%,${accent} 100%);padding:26px 24px;">
          <div style="color:#fff;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:.9;">trtDigital Mail</div>
          <div style="color:#fff;font-size:21px;font-weight:800;line-height:1.25;margin-top:6px;">${esc(input.heading)}</div>
          ${badge}
        </td></tr>
        <tr><td style="padding:24px;font-size:14px;line-height:1.6;color:#1f2937;">${input.bodyHtml}</td></tr>
        <tr><td style="padding:16px 24px 26px;border-top:1px solid #eef1f5;text-align:center;font-size:12px;color:#9ca3af;">
          ${esc(input.footerNote ?? "Automated notification from trtDigital Mail.")}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

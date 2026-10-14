/** TRT Digital signature template: animated dot logo on the left, contact lines with coloured dots on the right. */

export type TrtSignatureFields = {
	name: string;
	title: string;
	role: string;
	company: string;
	website: string;
	phones: string[];
};

export const DEFAULT_TRT_SIGNATURE: TrtSignatureFields = {
	name: "Laila Sqalli",
	title: "Directrice Marketing",
	role: "Account Manager (GCS - MENA)",
	company: "trtDigital Maroc",
	website: "www.trtdigital.ma",
	phones: ["+212660602820", "+212684496060"],
};

const DOT_COLORS = ["#2563eb", "#f59e0b", "#10b981", "#ef4444"];

function esc(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Table-based, inline-styled HTML so it renders in Gmail/Outlook/Apple Mail.
 * The logo is a hosted GIF (email clients cannot run Lottie); it plays once and ends on the full logo.
 * No nested <div> is used, because the composer strips signature blocks up to the first </div>.
 */
export function buildTrtSignatureHtml(origin: string, fields: TrtSignatureFields = DEFAULT_TRT_SIGNATURE): string {
	const base = origin.replace(/\/$/, "");
	const dot = (color: string) => `<span style="color:${color};font-size:18px;line-height:14px;">&#8226;</span>&nbsp;`;
	const href = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);
	const phones = fields.phones
		.map((phone) => `<a href="tel:${esc(phone.replace(/\s/g, ""))}" style="color:#374151;text-decoration:none;">${esc(phone)}</a>`)
		.join(" / ");
	const lines = [
		`<strong style="color:#111827;">${esc(fields.name)}</strong> - ${esc(fields.title)}`,
		esc(fields.role),
		`${esc(fields.company)} - <a href="${esc(href(fields.website))}" style="color:#2563eb;text-decoration:none;">${esc(fields.website)}</a>`,
		`T&eacute;l &amp; Whats: ${phones}`,
	];
	const rows = lines.map((line, index) => `${dot(DOT_COLORS[index % DOT_COLORS.length])}${line}`).join("<br>");

	return (
		`<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">` +
		`<tr>` +
		`<td valign="middle" style="padding:0 16px 0 0;border-right:2px solid #e5e7eb;">` +
		`<a href="${esc(href(fields.website))}"><img src="${base}/signature/trtdigital-dot-logo.gif" width="110" alt="trtDigital.ma" style="display:block;border:0;width:110px;height:auto;"></a>` +
		`</td>` +
		`<td valign="middle" style="padding:0 0 0 16px;font-size:13px;line-height:22px;color:#374151;">${rows}</td>` +
		`</tr>` +
		`</table>`
	);
}

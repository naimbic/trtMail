import { randomBytes } from "node:crypto";

/** Matches SIGNATURE_MARKER in the composer: links inside the signature block are never tracked. */
const SIGNATURE_ATTRIBUTE = "data-trt-signature";
const MAX_URL_LENGTH = 2000;
const MAX_LINKS = 100;

export type TrackedLink = { key: string; url: string };
export type InstrumentedHtml = { html: string; links: TrackedLink[] };

/** Random, unguessable, URL-safe. Never derived from the mail id or the recipient. */
export function newTrackingToken(): string {
	return randomBytes(24).toString("base64url");
}

function newLinkKey(): string {
	return randomBytes(9).toString("base64url");
}

function decodeEntities(value: string): string {
	return value
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, '"')
		.replace(/&#0*39;|&apos;/gi, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">");
}

function escapeAttribute(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Index range of the signature block (balanced <div> scan), or null when the mail has none. */
function findSignatureRange(html: string): [number, number] | null {
	const open = new RegExp(`<div\\b[^>]*${SIGNATURE_ATTRIBUTE}[^>]*>`, "i").exec(html);
	if (!open) return null;
	const start = open.index;
	const tag = /<(\/?)div\b[^>]*>/gi;
	tag.lastIndex = start;
	let depth = 0;
	for (let match = tag.exec(html); match; match = tag.exec(html)) {
		depth += match[1] ? -1 : 1;
		if (depth === 0) return [start, match.index + match[0].length];
	}
	return [start, html.length];
}

function isUnsubscribeLink(url: string, innerHtml: string): boolean {
	const text = innerHtml.replace(/<[^>]*>/g, " ");
	return /unsubscribe|unsub\b|opt[-_ ]?out|list-manage\.com\/unsubscribe|d[ée]sabonn|d[ée]sinscri/i.test(`${url} ${text}`);
}

/** A link whose visible text is itself a URL would look like phishing once rewritten, so it is left alone. */
function showsItsOwnUrl(innerHtml: string): boolean {
	const text = innerHtml.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim();
	return /^(https?:\/\/|www\.)/i.test(text);
}

/**
 * Rewrites http(s) links to `${baseUrl}/t/c/${token}/${key}` and appends the open pixel.
 * Plain-text mails are never passed here. Unsubscribe links, signature links, mailto:/tel:/#
 * links and links showing their own URL are left untouched.
 */
export function instrumentHtml(html: string, options: { baseUrl: string; token: string }): InstrumentedHtml {
	const baseUrl = options.baseUrl.replace(/\/+$/, "");
	const signature = findSignatureRange(html);
	const keyByUrl = new Map<string, string>();
	const links: TrackedLink[] = [];

	const rewritten = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi, (whole, attributes: string, inner: string, offset: number) => {
		if (signature && offset >= signature[0] && offset < signature[1]) return whole;
		const hrefMatch = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(attributes);
		if (!hrefMatch) return whole;
		const raw = decodeEntities((hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? "").trim());
		if (!raw || raw.length > MAX_URL_LENGTH) return whole;
		let url: URL;
		try {
			url = new URL(raw);
		} catch {
			return whole;
		}
		if (url.protocol !== "http:" && url.protocol !== "https:") return whole;
		if (raw.startsWith(`${baseUrl}/t/`)) return whole;
		if (isUnsubscribeLink(raw, inner) || showsItsOwnUrl(inner)) return whole;

		let key = keyByUrl.get(raw);
		if (!key) {
			if (links.length >= MAX_LINKS) return whole;
			key = newLinkKey();
			keyByUrl.set(raw, key);
			links.push({ key, url: raw });
		}
		const href = `href="${escapeAttribute(`${baseUrl}/t/c/${options.token}/${key}`)}"`;
		return `<a${attributes.replace(hrefMatch[0], href)}>${inner}</a>`;
	});

	const pixel =
		`<img src="${baseUrl}/t/o/${options.token}.gif" width="1" height="1" alt="" ` +
		`style="display:block;border:0;width:1px;height:1px;overflow:hidden;" />`;
	const bodyEnd = rewritten.search(/<\/body\s*>(?![\s\S]*<\/body\s*>)/i);
	const withPixel = bodyEnd >= 0 ? `${rewritten.slice(0, bodyEnd)}${pixel}${rewritten.slice(bodyEnd)}` : `${rewritten}${pixel}`;
	return { html: withPixel, links };
}

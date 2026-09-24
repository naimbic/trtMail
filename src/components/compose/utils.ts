import { authFetch } from "@/lib/auth/client";
import type { ComposeAttachment, ComposeDraft, DraftResponse } from "./types";

export async function fetchDraft(draftId: string): Promise<ComposeDraft> {
	const res = await authFetch(`/api/drafts/${draftId}`);
	const json = (await res.json()) as DraftResponse;

	if (!res.ok || !json.draft) {
		throw new Error(json.error ?? "Failed to load draft");
	}

	return json.draft;
}

export function buildSendFormData(input: {
	attachments: ComposeAttachment[];
	from: string;
	mailboxId?: string;
	subject: string;
	text: string;
	html?: string;
	to: string;
	cc?: string;
	bcc?: string;
}): FormData {
	const form = new FormData();
	form.set("from", input.from);
	form.set("to", input.to);
	if (input.cc && input.cc.trim()) form.set("cc", input.cc.trim());
	if (input.bcc && input.bcc.trim()) form.set("bcc", input.bcc.trim());
	form.set("subject", input.subject);
	form.set("text", input.text);
	if (input.html && input.html.trim()) form.set("html", input.html);
	if (input.mailboxId) form.set("mailboxId", input.mailboxId);
	for (const attachment of input.attachments) {
		form.append("attachments", attachment.file);
	}
	return form;
}

export function formatAttachmentSize(size: number): string {
	if (size < 1024) return `${size} B`;
	if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
	return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function applyMailboxSignature(
	text: string,
	previousSignature: string | null | undefined,
	nextSignature: string | null | undefined,
): string {
	const previousBlock = formatSignatureBlock(previousSignature);
	const nextBlock = formatSignatureBlock(nextSignature);
	if (previousBlock && text.includes(previousBlock)) {
		return text.replace(previousBlock, nextBlock);
	}
	if (!nextBlock || text.includes(nextBlock)) return text;
	if (!text) return nextBlock;
	if (/^\s*[^\n]+ wrote:\n>/i.test(text)) return `${nextBlock}${text}`;
	return `${text}${nextBlock}`;
}

function formatSignatureBlock(signature: string | null | undefined): string {
	const value = signature?.trim() ?? "";
	return value ? `\n\n${value}` : "";
}

// --- HTML-aware signature handling (composer body is HTML-first) --------------

/** Marker so we can find + swap the signature block without touching the user's text. */
export const SIGNATURE_MARKER = "data-trt-signature";

/** True when the stored signature is HTML (from the rich editor) rather than plain text. */
export function isHtmlSignature(signature: string | null | undefined): boolean {
	return /<[a-z][\s\S]*>/i.test(signature ?? "");
}

/** Wrap a signature (HTML or plain) into a marked block appended to the body HTML. */
export function signatureBlockHtml(signature: string | null | undefined): string {
	const value = signature?.trim() ?? "";
	if (!value) return "";
	const inner = isHtmlSignature(value) ? value : escapeHtml(value).replace(/\n/g, "<br>");
	return `<br><br><div ${SIGNATURE_MARKER}="1">${inner}</div>`;
}

/** Remove any previously-inserted signature block (+ the blank lines before it). */
export function stripSignatureBlock(html: string): string {
	return html
		.replace(new RegExp(`<div ${SIGNATURE_MARKER}="1">[\\s\\S]*?</div>`, "gi"), "")
		.replace(/(?:\s*<br\s*\/?>\s*){1,3}$/i, "");
}

/** Replace the current signature block in the body HTML with the mailbox's signature. */
export function applyMailboxSignatureHtml(
	html: string,
	nextSignature: string | null | undefined,
): string {
	const base = stripSignatureBlock(html ?? "");
	const block = signatureBlockHtml(nextSignature);
	if (!block) return base;
	return base ? `${base}${block}` : block;
}

/** Best-effort plain-text of an HTML fragment (used for draft "empty?" checks). */
export function htmlToPlainText(html: string | null | undefined): string {
	return (html ?? "")
		.replace(/<br\s*\/?>(?=)/gi, "\n")
		.replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.trim();
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

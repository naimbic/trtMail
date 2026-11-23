import PostalMime from "postal-mime";
import type { DeliveryReport } from "./service";

function decode(content: ArrayBuffer | string | Uint8Array | undefined | null): string {
	if (!content) return "";
	if (typeof content === "string") return content;
	return new TextDecoder().decode(content instanceof Uint8Array ? content : new Uint8Array(content));
}

function field(block: string, name: string): string | null {
	const match = new RegExp(`^${name}:[ \\t]*([^\\r\\n]*(?:\\r?\\n[ \\t]+[^\\r\\n]*)*)`, "im").exec(block);
	return match ? match[1].replace(/\s+/g, " ").trim() : null;
}

function mapAction(value: string | null): DeliveryReport["action"] | null {
	switch ((value ?? "").toLowerCase()) {
		case "failed":
			return "failed";
		case "delivered":
			return "delivered";
		case "delayed":
			return "delayed";
		case "relayed":
			return "relayed";
		case "expanded":
			return "expanded";
		default:
			return null;
	}
}

/**
 * Reads a bounce / delivery report (RFC 3464 multipart/report) and returns one report per failed or
 * delivered recipient, each carrying the Message-ID of the mail it is about. Returns [] for any other mail.
 */
export async function parseDeliveryReports(raw: ArrayBuffer): Promise<DeliveryReport[]> {
	const email = await PostalMime.parse(raw);
	const headers = new Map(email.headers.map((header) => [header.key.toLowerCase(), header.value]));
	const contentType = (headers.get("content-type") ?? "").toLowerCase();
	const isReport = contentType.includes("multipart/report") && contentType.includes("delivery-status");
	if (!isReport) return [];

	const statusPart = email.attachments.find((attachment) => attachment.mimeType.toLowerCase() === "message/delivery-status");
	if (!statusPart) return [];
	const original = email.attachments.find((attachment) => /^(message\/rfc822|text\/rfc822-headers)$/i.test(attachment.mimeType));
	const originalText = decode(original?.content);
	const originalMessageId =
		field(originalText, "Message-ID") ?? field(decode(statusPart.content), "X-Original-Message-ID") ?? field(decode(statusPart.content), "Original-Message-ID");
	if (!originalMessageId) return [];
	const id = /<[^>]+>/.exec(originalMessageId)?.[0] ?? originalMessageId;

	// The delivery-status body is one block of per-message fields followed by one block per recipient.
	const blocks = decode(statusPart.content).split(/\r?\n\r?\n/).map((block) => block.trim()).filter(Boolean);
	const reports: DeliveryReport[] = [];
	for (const block of blocks) {
		const action = mapAction(field(block, "Action"));
		if (!action) continue;
		const recipient = (field(block, "Final-Recipient") ?? field(block, "Original-Recipient") ?? "").replace(/^rfc822;\s*/i, "") || null;
		reports.push({
			originalMessageId: id,
			action,
			status: field(block, "Status"),
			recipient,
			diagnostic: field(block, "Diagnostic-Code")?.replace(/^smtp;\s*/i, "") ?? null,
		});
	}
	return reports;
}

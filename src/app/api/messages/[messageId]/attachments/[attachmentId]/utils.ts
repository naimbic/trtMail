export function getAttachmentContentDisposition(filename: string, inline: boolean): string {
	// Header values must be Latin-1; send an ASCII fallback plus the real UTF-8 name (RFC 5987).
	const clean = filename.replace(/["\\\r\n]/g, "_");
	const ascii = clean.replace(/[^\x20-\x7e]/g, "_");
	const encoded = encodeURIComponent(clean).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
	return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** Chrome's built-in PDF viewer cannot run inside a sandboxed response, so PDFs get a sandbox-free policy. */
export function getAttachmentContentSecurityPolicy(contentType: string): string {
	if (contentType === "application/pdf") {
		return "default-src 'none'; object-src 'self'; img-src 'self' data: blob:; style-src 'unsafe-inline'";
	}
	return "default-src 'none'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'unsafe-inline'; sandbox";
}

export function isPreviewableAttachmentType(contentType: string): boolean {
	return (
		contentType === "application/pdf" ||
		contentType.startsWith("audio/") ||
		contentType.startsWith("video/") ||
		(contentType.startsWith("image/") && contentType !== "image/svg+xml") ||
		contentType.startsWith("text/plain") ||
		contentType === "application/json" ||
		contentType === "application/xml" ||
		contentType === "text/csv"
	);
}

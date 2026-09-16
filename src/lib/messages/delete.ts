import { inArray } from "drizzle-orm";
import type { getDb } from "@/db";
import { messageAttachments, messages } from "@/db/schema";

type Db = ReturnType<typeof getDb>;

/**
 * Permanently delete messages: remove their attachment blobs + raw MIME from R2,
 * then delete the rows (message_attachments cascade on message delete).
 * R2 failures are swallowed — the DB rows are still removed so the mail is gone from the UI.
 */
export async function permanentlyDeleteMessages(env: CloudflareEnv, db: Db, messageIds: string[]): Promise<number> {
	if (messageIds.length === 0) return 0;

	const bucket = (env as unknown as { BUCKET?: { delete: (key: string) => Promise<unknown> } }).BUCKET;
	if (bucket) {
		try {
			const attachments = await db
				.select({ r2Key: messageAttachments.r2Key })
				.from(messageAttachments)
				.where(inArray(messageAttachments.messageId, messageIds));
			const rawKeys = await db
				.select({ rawR2Key: messages.rawR2Key })
				.from(messages)
				.where(inArray(messages.id, messageIds));
			const keys = [
				...attachments.map((a) => a.r2Key),
				...rawKeys.map((m) => m.rawR2Key),
			].filter((k): k is string => Boolean(k));
			await Promise.all(keys.map((key) => bucket.delete(key).catch(() => {})));
		} catch {
			// Continue to delete the rows even if blob cleanup fails.
		}
	}

	await db.delete(messages).where(inArray(messages.id, messageIds));
	return messageIds.length;
}

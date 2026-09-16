import { and, eq, isNull, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { reminders, users, mailboxes, domains } from "@/db/schema";
import { sendEmail } from "@/lib/email/send";
import { renderSystemEmail } from "@/lib/email/templates";

const TYPE_LABEL: Record<string, string> = {
	reply: "Reply",
	call: "Call",
	contact: "Contact",
	follow_up: "Follow-up",
	task: "Task",
};

function esc(v: unknown): string {
	return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Send an email for reminders that have become due and were not yet notified.
 * Best-effort: always marks `reminded_at` so it fires once; email failures are swallowed.
 * Called from the worker cycle.
 */
export async function notifyDueReminders(env: CloudflareEnv): Promise<void> {
	const db = getDb(env);
	const due = await db
		.select()
		.from(reminders)
		.where(and(eq(reminders.status, "open"), isNull(reminders.remindedAt), lte(reminders.dueAt, new Date())))
		.limit(100);
	if (due.length === 0) return;

	for (const reminder of due) {
		// Mark first so a repeated cycle never double-sends.
		await db.update(reminders).set({ remindedAt: new Date() }).where(eq(reminders.id, reminder.id)).catch(() => {});

		const recipientId = reminder.assignedToUserId ?? reminder.userId;
		try {
			const [recipient] = await db.select().from(users).where(eq(users.id, recipientId)).limit(1);
			if (!recipient?.email) continue;
			// Use the recipient's first mailbox as the sending identity.
			const [mbx] = await db
				.select({ id: mailboxes.id, localPart: mailboxes.localPart, hostname: domains.hostname })
				.from(mailboxes)
				.innerJoin(domains, eq(mailboxes.domainId, domains.id))
				.where(eq(mailboxes.userId, recipientId))
				.limit(1);
			if (!mbx) continue;
			const from = `${mbx.localPart}@${mbx.hostname}`;
			const when = new Date(reminder.dueAt).toLocaleString();
			const label = TYPE_LABEL[reminder.type] ?? "Task";
			const html = renderSystemEmail({
				heading: reminder.title,
				badge: `${label} · due ${when}`,
				bodyHtml: `<p style="margin:0 0 12px;">This is your reminder — <strong>${esc(label)}</strong>, due <strong>${esc(when)}</strong>.</p>${
					reminder.notes ? `<p style="margin:0;white-space:pre-wrap;color:#4b5563;">${esc(reminder.notes)}</p>` : ""
				}`,
				footerNote: "Reminder from trtDigital Mail — open the app to mark it done.",
			});
			await sendEmail(env, {
				userId: recipientId,
				mailboxId: mbx.id,
				from,
				to: recipient.email,
				subject: `Reminder: ${reminder.title}`,
				text: `This is your reminder (${label}) due ${when}.\n\n${reminder.title}\n${reminder.notes ?? ""}`.trim(),
				html,
			});
		} catch {
			// In-app badge/list still surfaces it; ignore email failures.
		}
	}
}

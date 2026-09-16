import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { reminders } from "@/db/schema";
import { requireUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { createAuditLog } from "@/lib/mailboxes/audit";

const STATUSES = ["open", "done", "snoozed", "cancelled"] as const;

async function loadFor(env: CloudflareEnv, request: Request, id: string) {
	const user = await requireUser(env, request);
	const db = getDb(env);
	const [reminder] = await db.select().from(reminders).where(eq(reminders.id, id)).limit(1);
	if (!reminder) return { user, db, reminder: null as null };
	const allowed = reminder.userId === user.id || reminder.assignedToUserId === user.id || reminder.createdByUserId === user.id;
	return { user, db, reminder: allowed ? reminder : null };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const env = getEnv();
	const { id } = await params;
	const { user, db, reminder } = await loadFor(env, request, id);
	if (!reminder) return NextResponse.json({ error: "Reminder not found" }, { status: 404 });

	const body = (await request.json().catch(() => ({}))) as {
		status?: string;
		title?: string;
		notes?: string;
		dueAt?: string | number;
	};
	const update: Record<string, unknown> = {};
	if (body.status && STATUSES.includes(body.status as (typeof STATUSES)[number])) update.status = body.status;
	if (typeof body.title === "string" && body.title.trim()) update.title = body.title.trim();
	if (typeof body.notes === "string") update.notes = body.notes.trim();
	if (body.dueAt) {
		const dueAt = new Date(body.dueAt);
		if (!Number.isNaN(dueAt.getTime())) {
			update.dueAt = dueAt;
			if (!body.status) update.status = "open"; // rescheduling reopens
		}
	}
	if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
	await db.update(reminders).set(update).where(eq(reminders.id, id));
	if (update.status === "done") {
		await createAuditLog(env, { actorUserId: user.id, action: "reminder.complete", metadata: { id } }).catch(() => {});
	}
	return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const env = getEnv();
	const { id } = await params;
	const { db, reminder } = await loadFor(env, request, id);
	if (!reminder) return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
	await db.delete(reminders).where(eq(reminders.id, id));
	return NextResponse.json({ ok: true });
}

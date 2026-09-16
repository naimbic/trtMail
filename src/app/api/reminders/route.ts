import { and, desc, eq, lte, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { reminders } from "@/db/schema";
import { requireUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { newId } from "@/lib/ids";
import { can } from "@/lib/auth/roles";
import { createAuditLog } from "@/lib/mailboxes/audit";

const TYPES = ["reply", "call", "contact", "follow_up", "task"] as const;

// GET /api/reminders?filter=open|today|overdue|assigned|all
export async function GET(request: Request) {
	const env = getEnv();
	const user = await requireUser(env, request);
	const db = getDb(env);
	const filter = new URL(request.url).searchParams.get("filter") ?? "open";

	const mine = or(eq(reminders.userId, user.id), eq(reminders.assignedToUserId, user.id));
	let where = mine;
	if (filter === "assigned") where = and(eq(reminders.assignedToUserId, user.id), eq(reminders.status, "open"))!;
	else if (filter === "overdue") where = and(mine, eq(reminders.status, "open"), lte(reminders.dueAt, new Date()))!;
	else if (filter === "open" || filter === "today") where = and(mine, eq(reminders.status, "open"))!;

	const rows = await db.select().from(reminders).where(where).orderBy(reminders.dueAt).limit(500);
	return NextResponse.json({ reminders: rows });
}

// POST /api/reminders
export async function POST(request: Request) {
	const env = getEnv();
	const user = await requireUser(env, request);
	const body = (await request.json().catch(() => ({}))) as {
		title?: string;
		type?: string;
		notes?: string;
		dueAt?: string | number;
		messageId?: string;
		contactId?: string;
		assignedToUserId?: string;
	};
	const title = body.title?.trim();
	const dueAt = body.dueAt ? new Date(body.dueAt) : null;
	if (!title || !dueAt || Number.isNaN(dueAt.getTime())) {
		return NextResponse.json({ error: "A title and a valid due date are required" }, { status: 400 });
	}
	const type = TYPES.includes(body.type as (typeof TYPES)[number]) ? (body.type as (typeof TYPES)[number]) : "task";

	// Assigning to another user requires the capability.
	let assignedToUserId = user.id;
	if (body.assignedToUserId && body.assignedToUserId !== user.id) {
		if (!can(user, "assignReminders")) {
			return NextResponse.json({ error: "You cannot assign reminders to others" }, { status: 403 });
		}
		assignedToUserId = body.assignedToUserId;
	}

	const db = getDb(env);
	const row = {
		id: newId("rem"),
		userId: user.id,
		assignedToUserId,
		createdByUserId: user.id,
		type,
		title,
		notes: body.notes?.trim() ?? "",
		messageId: body.messageId ?? null,
		contactId: body.contactId ?? null,
		dueAt,
		status: "open" as const,
		remindedAt: null,
	};
	await db.insert(reminders).values(row);
	await createAuditLog(env, {
		actorUserId: user.id,
		targetUserId: assignedToUserId !== user.id ? assignedToUserId : undefined,
		messageId: body.messageId,
		action: "reminder.create",
		metadata: { type, title },
	}).catch(() => {});
	return NextResponse.json({ reminder: row }, { status: 201 });
}

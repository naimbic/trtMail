import { and, eq, lte, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { reminders } from "@/db/schema";
import { requireUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";

// GET /api/reminders/due — count of open reminders due now/overdue (for the nav badge).
export async function GET(request: Request) {
	const env = getEnv();
	const user = await requireUser(env, request);
	const db = getDb(env);
	const [row] = await db
		.select({ count: sql<number>`count(*)` })
		.from(reminders)
		.where(
			and(
				or(eq(reminders.userId, user.id), eq(reminders.assignedToUserId, user.id)),
				eq(reminders.status, "open"),
				lte(reminders.dueAt, new Date()),
			),
		);
	return NextResponse.json({ count: Number(row?.count ?? 0) });
}

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { messages } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { createAuditLog } from "@/lib/mailboxes/audit";
import { permanentlyDeleteMessages } from "@/lib/messages/delete";

// POST /api/messages/empty-trash — permanently delete everything in the user's Trash.
export async function POST(request: Request) {
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const db = getDb(env);
	const trashed = await db
		.select({ id: messages.id })
		.from(messages)
		.where(and(eq(messages.userId, user.id), eq(messages.status, "trash")));
	const ids = trashed.map((m) => m.id);
	if (ids.length === 0) return NextResponse.json({ ok: true, deleted: 0 });

	await createAuditLog(env, {
		actorUserId: user.id,
		action: "email.empty_trash",
		metadata: { count: ids.length },
	}).catch(() => {});
	const deleted = await permanentlyDeleteMessages(env, db, ids);
	return NextResponse.json({ ok: true, deleted });
}

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getEnv } from "@/lib/cloudflare";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/cookies";
import { verifyCode, generateBackupCodes } from "@/lib/auth/totp";
import { createAuditLog } from "@/lib/mailboxes/audit";
import { getAuthActivityMetadata } from "@/lib/auth/activity";

// Confirm the first code and enable 2FA; returns one-time backup codes.
export async function POST(request: Request) {
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const body = (await request.json().catch(() => ({}))) as { code?: string };
	const code = typeof body.code === "string" ? body.code : "";
	if (!user.totpSecret) return NextResponse.json({ error: "Start 2FA setup first" }, { status: 400 });
	if (!(await verifyCode(user.totpSecret, code))) {
		return NextResponse.json({ error: "Invalid code" }, { status: 400 });
	}
	const { plain, hashed } = await generateBackupCodes();
	const db = getDb(env);
	await db.update(users).set({ totpEnabled: true, backupCodes: JSON.stringify(hashed) }).where(eq(users.id, user.id));
	await createAuditLog(env, {
		actorUserId: user.id,
		targetUserId: user.id,
		action: "2fa.enable",
		metadata: getAuthActivityMetadata(request),
	}).catch(() => {});
	return NextResponse.json({ ok: true, backupCodes: plain });
}

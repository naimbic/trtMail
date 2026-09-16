import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getEnv } from "@/lib/cloudflare";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/cookies";
import { verifyCode, consumeBackupCode } from "@/lib/auth/totp";
import { createAuditLog } from "@/lib/mailboxes/audit";
import { getAuthActivityMetadata } from "@/lib/auth/activity";

// Turn off 2FA — requires a current TOTP or backup code (a hijacked session can't silently disable it).
export async function POST(request: Request) {
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!user.totpEnabled || !user.totpSecret) {
		return NextResponse.json({ error: "2FA is not enabled" }, { status: 400 });
	}
	if (user.twoFactorRequired) {
		return NextResponse.json({ error: "2FA is required for your account by an administrator." }, { status: 403 });
	}
	const body = (await request.json().catch(() => ({}))) as { code?: string };
	const code = typeof body.code === "string" ? body.code : "";
	const stored: string[] = user.backupCodes ? JSON.parse(user.backupCodes) : [];
	const ok = (await verifyCode(user.totpSecret, code)) || (await consumeBackupCode(code, stored)) !== null;
	if (!ok) return NextResponse.json({ error: "Invalid code" }, { status: 400 });
	const db = getDb(env);
	await db.update(users).set({ totpEnabled: false, totpSecret: null, backupCodes: null }).where(eq(users.id, user.id));
	await createAuditLog(env, {
		actorUserId: user.id,
		targetUserId: user.id,
		action: "2fa.disable",
		metadata: getAuthActivityMetadata(request),
	}).catch(() => {});
	return NextResponse.json({ ok: true });
}

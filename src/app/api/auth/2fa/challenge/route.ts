import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getEnv } from "@/lib/cloudflare";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { parsePendingToken, verifyPendingToken } from "@/lib/auth/two-factor";
import { verifyCode, consumeBackupCode } from "@/lib/auth/totp";
import { allowLoginAttempt } from "@/lib/auth/rate-limit";
import { recordAuthActivity } from "@/lib/auth/activity";

// Second factor: exchange a pending token + TOTP/backup code for a real session.
export async function POST(request: Request) {
	const env = getEnv();
	if (!(await allowLoginAttempt(env, request))) {
		return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429, headers: { "Retry-After": "60" } });
	}
	const body = (await request.json().catch(() => ({}))) as { pendingToken?: string; code?: string };
	const pendingToken = typeof body.pendingToken === "string" ? body.pendingToken : "";
	const code = typeof body.code === "string" ? body.code : "";
	const parsed = parsePendingToken(pendingToken);
	if (!parsed) return NextResponse.json({ error: "Session expired. Please sign in again." }, { status: 400 });

	const db = getDb(env);
	const [user] = await db.select().from(users).where(eq(users.id, parsed.userId)).limit(1);
	if (!user || user.disabled || !user.totpEnabled || !user.totpSecret) {
		return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
	}
	if (!(await verifyPendingToken(pendingToken, user.passwordHash))) {
		return NextResponse.json({ error: "Session expired. Please sign in again." }, { status: 400 });
	}

	let authenticated = await verifyCode(user.totpSecret, code);
	if (!authenticated) {
		const stored: string[] = user.backupCodes ? JSON.parse(user.backupCodes) : [];
		const remaining = await consumeBackupCode(code, stored);
		if (remaining) {
			authenticated = true;
			await db.update(users).set({ backupCodes: JSON.stringify(remaining) }).where(eq(users.id, user.id));
		}
	}
	if (!authenticated) return NextResponse.json({ error: "Invalid code" }, { status: 401 });

	const token = await createSession(env, user.id);
	await recordAuthActivity(env, { action: "auth.login", userId: user.id, request });
	const response = NextResponse.json({ ok: true, token, redirect: "/inbox" });
	response.headers.set("Cache-Control", "no-store");
	response.cookies.set(SESSION_COOKIE, token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 60 * 60 * 24 * 30,
	});
	return response;
}

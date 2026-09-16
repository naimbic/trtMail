import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getEnv } from "@/lib/cloudflare";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/cookies";
import { SUPER_ADMIN_ID } from "@/lib/auth/super-admin";
import { generateSecret, otpauthUrl } from "@/lib/auth/totp";

const ISSUER = "trtDigital Mail";

// Begin TOTP enrollment: generate a secret, store it (still disabled), return the QR URI.
export async function POST(request: Request) {
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (user.id === SUPER_ADMIN_ID) {
		return NextResponse.json({ error: "The super-admin uses SUPER_ADMIN_TOTP_SECRET in env." }, { status: 400 });
	}
	const secret = generateSecret();
	const db = getDb(env);
	await db.update(users).set({ totpSecret: secret, totpEnabled: false }).where(eq(users.id, user.id));
	return NextResponse.json({ secret, otpauthUrl: otpauthUrl(secret, user.email, ISSUER) });
}

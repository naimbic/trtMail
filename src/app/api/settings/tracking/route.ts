import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/cookies";
import { isAdmin } from "@/lib/auth/admin";
import { getEnv } from "@/lib/cloudflare";
import { getTrackingBaseUrl, isMailTrackingEnabled, setMailTrackingEnabled } from "@/lib/tracking/settings";

export async function GET(request: Request) {
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	return NextResponse.json({
		enabled: await isMailTrackingEnabled(env),
		publicUrlConfigured: !!getTrackingBaseUrl(env),
		canChange: isAdmin(user),
	});
}

export async function PUT(request: Request) {
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	const parsed = z.object({ enabled: z.boolean() }).safeParse(await request.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
	await setMailTrackingEnabled(env, parsed.data.enabled);
	return NextResponse.json({ enabled: parsed.data.enabled });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { listTrackingNotifications } from "@/lib/tracking/service";

/** First open / first click of the sender's mails since `after` (ISO time). The client polls this. */
export async function GET(request: Request) {
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const after = new Date(new URL(request.url).searchParams.get("after") ?? "");
	const now = new Date();
	const since = Number.isNaN(after.getTime()) ? now : after;
	const events = await listTrackingNotifications(env, user, since);
	return NextResponse.json({ events, now: now.toISOString() }, { headers: { "Cache-Control": "no-store" } });
}

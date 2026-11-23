import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { getTrackingDetail } from "@/lib/tracking/service";

export async function GET(request: Request, { params }: { params: Promise<{ messageId: string }> }) {
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const { messageId } = await params;
	const detail = await getTrackingDetail(env, user, messageId);
	if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
	return NextResponse.json(detail, { headers: { "Cache-Control": "no-store" } });
}

import { createHash } from "node:crypto";

export const TRACKING_RATE_LIMIT_PER_IP = 240; // hits per minute per client address
export const TRACKING_RATE_LIMIT_GLOBAL = 6000; // hits per minute overall (bounds database writes)

export function clientAddress(request: Request): string {
	const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
	return request.headers.get("cf-connecting-ip")?.trim() || forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Short one-way hash: used for rate-limit keys and stored with events instead of the raw address. */
export function hashAddress(address: string): string {
	return createHash("sha256").update(`trt-track:${address}`).digest("hex").slice(0, 16);
}

async function bump(env: CloudflareEnv, key: string): Promise<number> {
	const value = await env.DB.prepare(
		"INSERT INTO _cf_server_state(key,value) VALUES (?, '1') ON CONFLICT(key) DO UPDATE SET value=CAST(value AS INTEGER)+1 RETURNING value",
	)
		.bind(key)
		.first<number | string>("value");
	return Number(value ?? 0);
}

/** Fixed-window limiter backed by the server state table. Fails open if the table is unavailable. */
export async function allowTrackingHit(env: CloudflareEnv, request: Request): Promise<boolean> {
	try {
		const minute = Math.floor(Date.now() / 60_000);
		const [perIp, global] = await Promise.all([
			bump(env, `trk:${hashAddress(clientAddress(request))}:${minute}`),
			bump(env, `trkall:${minute}`),
		]);
		return perIp <= TRACKING_RATE_LIMIT_PER_IP && global <= TRACKING_RATE_LIMIT_GLOBAL;
	} catch {
		return true;
	}
}

import { getEnv } from "@/lib/cloudflare";
import { allowTrackingHit, clientAddress, hashAddress } from "@/lib/tracking/rate-limit";
import { lookupTrackedLink, recordClick } from "@/lib/tracking/service";

// Public click-tracking redirect. No sign-in. The destination comes only from the links stored for
// the mail the token belongs to, never from the request, so this is not an open redirect. Unknown
// token and unknown link give the same answer.
export const dynamic = "force-dynamic";

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{16,128}$/;
const KEY_FORMAT = /^[A-Za-z0-9_-]{6,64}$/;
const NO_STORE = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" };

function notFound(): Response {
	return new Response("Not found", { status: 404, headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" } });
}

function redirect(url: string): Response {
	try {
		const target = new URL(url);
		if (target.protocol !== "http:" && target.protocol !== "https:") return notFound();
		return new Response(null, { status: 302, headers: { ...NO_STORE, Location: target.toString() } });
	} catch {
		return notFound();
	}
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string; link: string }> }) {
	const { token, link } = await params;
	if (!TOKEN_FORMAT.test(token) || !KEY_FORMAT.test(link)) return notFound();
	try {
		const env = getEnv();
		if (!(await allowTrackingHit(env, request))) {
			return new Response("Too many requests", { status: 429, headers: { ...NO_STORE, "Retry-After": "60", "Content-Type": "text/plain; charset=utf-8" } });
		}
		const result = await recordClick(env, token, link, {
			ipHash: hashAddress(clientAddress(request)),
			userAgent: request.headers.get("user-agent") ?? "",
		});
		return result.url ? redirect(result.url) : notFound();
	} catch (error) {
		console.error("Click tracking failed", error);
		return notFound();
	}
}

// Link scanners often probe with HEAD: answer like GET but record nothing.
export async function HEAD(request: Request, { params }: { params: Promise<{ token: string; link: string }> }) {
	const { token, link } = await params;
	if (!TOKEN_FORMAT.test(token) || !KEY_FORMAT.test(link)) return notFound();
	try {
		const url = await lookupTrackedLink(getEnv(), token, link);
		return url ? redirect(url) : notFound();
	} catch {
		return notFound();
	}
}

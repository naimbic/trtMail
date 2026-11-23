import { getEnv } from "@/lib/cloudflare";
import { TRANSPARENT_GIF } from "@/lib/tracking/gif";
import { allowTrackingHit, clientAddress, hashAddress } from "@/lib/tracking/rate-limit";
import { recordOpen } from "@/lib/tracking/service";

// Public open-tracking pixel. No sign-in. It answers exactly the same way for every token, so the
// response never reveals whether a token exists.
export const dynamic = "force-dynamic";

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{16,128}$/;

function pixel(): Response {
	return new Response(new Uint8Array(TRANSPARENT_GIF), {
		status: 200,
		headers: {
			"Content-Type": "image/gif",
			"Content-Length": String(TRANSPARENT_GIF.length),
			"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
			Pragma: "no-cache",
			"X-Robots-Tag": "noindex",
			"Referrer-Policy": "no-referrer",
		},
	});
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
	const token = (await params).token.replace(/\.gif$/i, "");
	try {
		if (TOKEN_FORMAT.test(token)) {
			const env = getEnv();
			// Over the limit: still answer with the pixel, just record nothing.
			if (await allowTrackingHit(env, request)) {
				await recordOpen(env, token, {
					ipHash: hashAddress(clientAddress(request)),
					userAgent: request.headers.get("user-agent") ?? "",
				});
			}
		}
	} catch (error) {
		console.error("Open tracking failed", error);
	}
	return pixel();
}

export async function HEAD() {
	return pixel();
}

/**
 * Two-factor login flow helpers.
 *
 * When a user with 2FA enabled passes the password step, the server issues a short-lived,
 * stateless "pending" token (no DB row). The client then submits it with a TOTP or backup
 * code to /api/auth/2fa/challenge to obtain a real session. The token is HMAC-signed with the
 * user's own password hash (server-only secret, stable, per-user) so no global secret is needed.
 */

const PREFIX = "p2f.";
const TTL_MS = 1000 * 60 * 5; // 5 minutes to complete the second factor

async function hmacHex(key: string, data: string): Promise<string> {
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(key),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
	return Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export async function createPendingToken(userId: string, passwordHash: string): Promise<string> {
	const exp = Date.now() + TTL_MS;
	const payload = `${PREFIX}${userId}.${exp}`;
	const sig = await hmacHex(passwordHash, payload);
	return `${payload}.${sig}`;
}

/** Parse without verifying the signature (to look up the user first). */
export function parsePendingToken(token: string): { userId: string; exp: number } | null {
	if (!token.startsWith(PREFIX)) return null;
	const parts = token.slice(PREFIX.length).split(".");
	if (parts.length !== 3) return null;
	const [userId, expRaw] = parts;
	const exp = Number(expRaw);
	if (!userId || !Number.isFinite(exp)) return null;
	return { userId, exp };
}

export async function verifyPendingToken(token: string, passwordHash: string): Promise<boolean> {
	const parsed = parsePendingToken(token);
	if (!parsed || parsed.exp < Date.now()) return false;
	const parts = token.slice(PREFIX.length).split(".");
	const payload = `${PREFIX}${parts[0]}.${parts[1]}`;
	const expected = await hmacHex(passwordHash, payload);
	const provided = parts[2];
	if (expected.length !== provided.length) return false;
	let diff = 0;
	for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
	return diff === 0;
}

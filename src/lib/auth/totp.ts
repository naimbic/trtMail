/**
 * RFC-6238 TOTP + backup codes, implemented with Web Crypto (crypto.subtle).
 * No external dependency; works on Node and edge runtimes (same as session.ts hashing).
 * Compatible with Google Authenticator / Authy (SHA1, 6 digits, 30s period).
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIOD = 30;
const DIGITS = 6;

function base32Encode(bytes: Uint8Array): string {
	let bits = 0;
	let value = 0;
	let output = "";
	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
	return output;
}

function base32Decode(input: string): Uint8Array {
	const clean = input.replace(/=+$/g, "").toUpperCase().replace(/\s/g, "");
	let bits = 0;
	let value = 0;
	const out: number[] = [];
	for (const char of clean) {
		const idx = BASE32_ALPHABET.indexOf(char);
		if (idx === -1) continue;
		value = (value << 5) | idx;
		bits += 5;
		if (bits >= 8) {
			out.push((value >>> (bits - 8)) & 0xff);
			bits -= 8;
		}
	}
	return new Uint8Array(out);
}

/** Generate a new base32 TOTP secret (default 20 random bytes = 160 bits). */
export function generateSecret(byteLength = 20): string {
	const bytes = new Uint8Array(byteLength);
	crypto.getRandomValues(bytes);
	return base32Encode(bytes);
}

/** otpauth:// URI for QR enrollment. */
export function otpauthUrl(secret: string, accountEmail: string, issuer = "trtDigital Mail"): string {
	const label = encodeURIComponent(`${issuer}:${accountEmail}`);
	const params = new URLSearchParams({
		secret,
		issuer,
		algorithm: "SHA1",
		digits: String(DIGITS),
		period: String(PERIOD),
	});
	return `otpauth://totp/${label}?${params.toString()}`;
}

async function hotp(secret: string, counter: number): Promise<string> {
	const key = base32Decode(secret);
	const counterBytes = new Uint8Array(8);
	let c = counter;
	for (let i = 7; i >= 0; i--) {
		counterBytes[i] = c & 0xff;
		c = Math.floor(c / 256);
	}
	const cryptoKey = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
	const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, counterBytes));
	const offset = sig[sig.length - 1] & 0x0f;
	const binary =
		((sig[offset] & 0x7f) << 24) |
		((sig[offset + 1] & 0xff) << 16) |
		((sig[offset + 2] & 0xff) << 8) |
		(sig[offset + 3] & 0xff);
	return (binary % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

/** Current TOTP code (mainly for tests / server-side display). */
export async function generateCode(secret: string, atMs: number = Date.now()): Promise<string> {
	return hotp(secret, Math.floor(atMs / 1000 / PERIOD));
}

/** Verify a 6-digit code, tolerating ±`window` time steps for clock drift. */
export async function verifyCode(secret: string, code: string, window = 1, atMs: number = Date.now()): Promise<boolean> {
	const cleaned = code.replace(/\s/g, "");
	if (!/^\d{6}$/.test(cleaned)) return false;
	const counter = Math.floor(atMs / 1000 / PERIOD);
	for (let offset = -window; offset <= window; offset++) {
		if (await hotp(secret, counter + offset) === cleaned) return true;
	}
	return false;
}

/* ── Backup codes ─────────────────────────────────────────── */

async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function randomCode(): string {
	const bytes = new Uint8Array(5);
	crypto.getRandomValues(bytes);
	// 10 hex chars, grouped xxxxx-xxxxx for readability
	const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 5)}-${hex.slice(5, 10)}`;
}

/** Returns { plain: string[] (show once), hashed: string[] (store) }. */
export async function generateBackupCodes(count = 10): Promise<{ plain: string[]; hashed: string[] }> {
	const plain = Array.from({ length: count }, () => randomCode());
	const hashed = await Promise.all(plain.map((code) => sha256Hex(code)));
	return { plain, hashed };
}

/** Verify a backup code against the stored hashes; returns the remaining hashes (used one removed) or null. */
export async function consumeBackupCode(code: string, storedHashes: string[]): Promise<string[] | null> {
	const hash = await sha256Hex(code.trim().toLowerCase());
	const idx = storedHashes.indexOf(hash);
	if (idx === -1) return null;
	return storedHashes.filter((_, i) => i !== idx);
}

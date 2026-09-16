import { verifyPassword } from "./password";
import type { users } from "@/db/schema";

/**
 * Env-only super-admin. Never stored in the DB, never listed, never editable.
 * Configured via process.env:
 *   SUPER_ADMIN_EMAIL          — login email
 *   SUPER_ADMIN_PASSWORD_HASH  — bcrypt hash of the password (also used as the token-signing key)
 *   SUPER_ADMIN_TOTP_SECRET    — optional base32 TOTP secret to also 2FA the super-admin
 *
 * Because the `sessions` table has a FK to `users`, the super-admin session is NOT a DB row.
 * It is a self-contained HMAC-signed cookie token (`sa.<exp>.<sig>`) resolved in getUserFromSession.
 */

export const SUPER_ADMIN_ID = "super-admin";
const TOKEN_PREFIX = "sa.";
const TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

type SuperAdminUser = typeof users.$inferSelect;

function cfg() {
	return {
		email: process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() ?? "",
		passwordHash: process.env.SUPER_ADMIN_PASSWORD_HASH ?? "",
		totpSecret: process.env.SUPER_ADMIN_TOTP_SECRET?.trim() ?? "",
	};
}

export function isSuperAdminConfigured(): boolean {
	const { email, passwordHash } = cfg();
	return Boolean(email && passwordHash);
}

export function superAdminHasTotp(): boolean {
	return isSuperAdminConfigured() && Boolean(cfg().totpSecret);
}

export function isSuperAdminEmail(email: string): boolean {
	if (!isSuperAdminConfigured()) return false;
	return email.trim().toLowerCase() === cfg().email;
}

export function verifySuperAdminPassword(password: string): boolean {
	if (!isSuperAdminConfigured()) return false;
	try {
		return verifyPassword(password, cfg().passwordHash);
	} catch {
		return false;
	}
}

export function superAdminUser(): SuperAdminUser {
	return {
		id: SUPER_ADMIN_ID,
		email: cfg().email,
		resetEmail: null,
		forwardingEmail: null,
		passwordHash: "",
		name: "Super Admin",
		avatarKey: null,
		role: "super_admin",
		totpSecret: null,
		totpEnabled: false,
		twoFactorRequired: false,
		backupCodes: null,
		disabled: false,
		canManageMailboxes: true,
		createdByUserId: null,
		createdAt: new Date(0),
	};
}

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

export async function createSuperAdminToken(): Promise<string> {
	const exp = Date.now() + TTL_MS;
	const payload = `${TOKEN_PREFIX}${exp}`;
	const sig = await hmacHex(cfg().passwordHash, payload);
	return `${payload}.${sig}`;
}

export function isSuperAdminToken(token: string | undefined): boolean {
	return typeof token === "string" && token.startsWith(TOKEN_PREFIX);
}

export async function resolveSuperAdminToken(token: string): Promise<SuperAdminUser | null> {
	if (!isSuperAdminConfigured() || !isSuperAdminToken(token)) return null;
	const parts = token.split("."); // ["sa", "<exp>", "<sig>"]
	if (parts.length !== 3) return null;
	const exp = Number(parts[1]);
	if (!Number.isFinite(exp) || exp < Date.now()) return null;
	const expected = await hmacHex(cfg().passwordHash, `${TOKEN_PREFIX}${parts[1]}`);
	const provided = parts[2];
	if (expected.length !== provided.length) return null;
	let diff = 0;
	for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
	if (diff !== 0) return null;
	return superAdminUser();
}

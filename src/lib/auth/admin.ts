import type { SessionUser } from "./types";

/** Admin-tier = full app administration. super_admin (env-only) always qualifies. */
export function isAdmin(user: Pick<SessionUser, "role">): boolean {
	return user.role === "admin" || user.role === "super_admin";
}

export function assertAdmin(user: Pick<SessionUser, "role">): void {
	if (!isAdmin(user)) {
		throw new Error("Forbidden");
	}
}

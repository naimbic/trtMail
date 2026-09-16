import type { SessionUser, UserRole } from "./types";

/**
 * Role capability model for trtMail.
 *
 * Hierarchy: super_admin > admin > manager > user (agent).
 * - super_admin: env-only, invisible, bypasses every check (see super-admin.ts).
 * - admin: full app administration (users, domains, settings, licenses…).
 * - manager: manages assigned mailboxes, the users they created, and reminders —
 *   but NOT global settings, domains, or licensing.
 * - user (agent): their own inbox + granted mailboxes + their own reminders.
 */

export type Capability =
	| "manageUsers"
	| "manageDomains"
	| "manageSettings"
	| "manageMailboxes"
	| "assignMailboxAccess"
	| "manageReminders"
	| "assignReminders"
	| "viewAudit"
	| "manageApiKeys"
	| "manageWebhooks"
	| "manageBackups"
	| "manageLicenses";

const MATRIX: Record<UserRole, Capability[] | "*"> = {
	super_admin: "*",
	admin: [
		"manageUsers",
		"manageDomains",
		"manageSettings",
		"manageMailboxes",
		"assignMailboxAccess",
		"manageReminders",
		"assignReminders",
		"viewAudit",
		"manageApiKeys",
		"manageWebhooks",
		"manageBackups",
		"manageLicenses",
	],
	manager: ["manageUsers", "manageMailboxes", "assignMailboxAccess", "manageReminders", "assignReminders", "viewAudit"],
	user: ["manageReminders"],
};

export function can(user: Pick<SessionUser, "role">, capability: Capability): boolean {
	const caps = MATRIX[user.role];
	return caps === "*" || caps.includes(capability);
}

export function assertCan(user: Pick<SessionUser, "role">, capability: Capability): void {
	if (!can(user, capability)) {
		throw new Error("Forbidden");
	}
}

/** Roles an admin UI is allowed to assign. super_admin is env-only and never assignable. */
export const ASSIGNABLE_ROLES: UserRole[] = ["admin", "manager", "user"];

/** Whether `actor` may assign `targetRole` to a managed account. */
export function canAssignRole(actor: Pick<SessionUser, "role">, targetRole: UserRole): boolean {
	if (targetRole === "super_admin") return false; // never assignable through the app
	switch (actor.role) {
		case "super_admin":
		case "admin":
			return targetRole === "admin" || targetRole === "manager" || targetRole === "user";
		case "manager":
			return targetRole === "user"; // managers can only create agents
		default:
			return false;
	}
}

export function roleLabel(role: UserRole): string {
	switch (role) {
		case "super_admin":
			return "Super Admin";
		case "admin":
			return "Admin";
		case "manager":
			return "Manager";
		default:
			return "Agent";
	}
}

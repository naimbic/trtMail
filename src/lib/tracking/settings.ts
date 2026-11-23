import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings } from "@/db/schema";
import { APP_SETTINGS_ID } from "@/lib/branding/service";

/** Mail tracking (open pixel + click redirects) is on by default and can be switched off for the whole installation. */
export async function isMailTrackingEnabled(env: CloudflareEnv): Promise<boolean> {
	try {
		const [row] = await getDb(env)
			.select({ enabled: appSettings.mailTrackingEnabled })
			.from(appSettings)
			.where(eq(appSettings.id, APP_SETTINGS_ID))
			.limit(1);
		return row ? row.enabled : true;
	} catch {
		return false;
	}
}

export async function setMailTrackingEnabled(env: CloudflareEnv, enabled: boolean): Promise<void> {
	await getDb(env)
		.insert(appSettings)
		.values({ id: APP_SETTINGS_ID, mailTrackingEnabled: enabled })
		.onConflictDoUpdate({
			target: appSettings.id,
			set: { mailTrackingEnabled: enabled, updatedAt: new Date() },
		});
}

/** Public base URL put into tracking links. Needs an absolute http(s) APP_URL; otherwise tracking is skipped. */
export function getTrackingBaseUrl(env: CloudflareEnv): string | null {
	const raw = String((env as unknown as Record<string, unknown>).APP_URL ?? "").trim();
	if (!raw) return null;
	try {
		const url = new URL(raw);
		if (url.protocol !== "https:" && url.protocol !== "http:") return null;
		return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
	} catch {
		return null;
	}
}

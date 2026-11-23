import { and, asc, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import { messageTrackingEvents, messageTrackingLinks, messages } from "@/db/schema";
import { newId } from "@/lib/ids";
import { dispatchWebhooks } from "@/lib/email/webhooks";
import { listAccessibleMailboxIds } from "@/lib/mailboxes/access";
import type { SessionUser } from "@/lib/auth/types";
import { instrumentHtml, newTrackingToken } from "./instrument";
import { getTrackingBaseUrl, isMailTrackingEnabled } from "./settings";

/** Hits this soon after sending come from the recipient's mail server or a scanner, not a person. */
export const OPEN_IGNORE_MS = 15_000;
export const CLICK_IGNORE_MS = 10_000;
/** Opens from the same client closer together than this count once (image re-requests). */
export const OPEN_DEDUPE_MS = 3_000;
/** Clicking every link of a mail inside this window is a link scanner. */
export const SCANNER_BURST_MS = 6_000;
const BOT_USER_AGENT = /(bot\b|crawler|spider|preview|proofpoint|mimecast|barracuda|symantec|safelinks|urldefense|trendmicro|forcepoint|zscaler|sophos|fireeye|mailscanner|virustotal)/i;
const MAX_EVENTS_PER_MESSAGE = 500;

export type DeliveryStatus = "queued" | "sent" | "delivered" | "bounced" | "failed";

type TrackingContext = { ipHash: string; userAgent: string; now?: Date };

function clip(value: string | null | undefined, max: number): string | null {
	const text = (value ?? "").replace(/\s+/g, " ").trim();
	return text ? text.slice(0, max) : null;
}

// ---------- preparing a mail for sending ----------

/**
 * Returns the HTML to actually send (links rewritten, pixel appended) and stores the token + links,
 * or null when this mail must be left untouched: tracking off, no HTML, or no public URL configured.
 * The mail row keeps the original, un-instrumented HTML so viewing it never fires the pixel.
 */
export async function prepareTrackedHtml(
	env: CloudflareEnv,
	messageId: string,
	html: string | undefined,
	options: { track?: boolean } = {},
): Promise<string | null> {
	if (options.track === false || !html?.trim()) return null;
	if (!(await isMailTrackingEnabled(env))) return null;
	const baseUrl = getTrackingBaseUrl(env);
	if (!baseUrl) return null;

	const token = newTrackingToken();
	const instrumented = instrumentHtml(html, { baseUrl, token });
	const db = getDb(env);
	await db.update(messages).set({ trackingToken: token }).where(eq(messages.id, messageId));
	for (const link of instrumented.links) {
		await db.insert(messageTrackingLinks).values({ id: newId("lnk"), messageId, linkKey: link.key, url: link.url });
	}
	return instrumented.html;
}

// ---------- delivery status ----------

export async function recordAccepted(
	env: CloudflareEnv,
	messageId: string,
	info: { response?: string | null; accepted?: string[]; rejected?: string[] },
): Promise<void> {
	const db = getDb(env);
	const now = new Date();
	const detail = clip(info.response, 500) ?? "Accepted by the outgoing mail server";
	await db.update(messages).set({ deliveryStatus: "sent", deliveryDetail: detail, sentAt: now }).where(eq(messages.id, messageId));
	await db.insert(messageTrackingEvents).values({
		id: newId("evt"),
		messageId,
		type: "accepted",
		at: now,
		detail: clip(`${detail}${info.accepted?.length ? ` · to ${info.accepted.join(", ")}` : ""}`, 600),
	});
}

export async function recordSendFailure(env: CloudflareEnv, messageId: string, detail: string): Promise<void> {
	const db = getDb(env);
	const now = new Date();
	await db
		.update(messages)
		.set({ deliveryStatus: "failed", deliveryDetail: clip(detail, 500), bouncedAt: null })
		.where(eq(messages.id, messageId));
	await db.insert(messageTrackingEvents).values({ id: newId("evt"), messageId, type: "failed", at: now, detail: clip(detail, 600) });
}

async function markDelivered(env: CloudflareEnv, messageId: string, reason: string): Promise<void> {
	const db = getDb(env);
	const [message] = await db
		.select({ status: messages.deliveryStatus })
		.from(messages)
		.where(eq(messages.id, messageId))
		.limit(1);
	if (!message || message.status === "delivered" || message.status === "bounced" || message.status === "failed") return;
	const now = new Date();
	await db.update(messages).set({ deliveryStatus: "delivered", deliveredAt: now }).where(eq(messages.id, messageId));
	await db.insert(messageTrackingEvents).values({ id: newId("evt"), messageId, type: "delivered", at: now, detail: reason });
}

export type DeliveryReport = {
	originalMessageId: string;
	action: "failed" | "delivered" | "delayed" | "relayed" | "expanded";
	status?: string | null;
	recipient?: string | null;
	diagnostic?: string | null;
};

/** Applies a bounce / delivery report (DSN) that was read from the mailbox to the mail it is about. */
export async function applyDeliveryReport(env: CloudflareEnv, report: DeliveryReport): Promise<boolean> {
	const bare = report.originalMessageId.trim().replace(/^<|>$/g, "");
	if (!bare) return false;
	const db = getDb(env);
	const [message] = await db
		.select()
		.from(messages)
		.where(and(eq(messages.direction, "outbound"), inArray(messages.providerMessageId, [bare, `<${bare}>`])))
		.limit(1);
	if (!message) return false;

	const now = new Date();
	const detail = clip([report.recipient, report.status, report.diagnostic].filter(Boolean).join(" · "), 600);
	const type = report.action === "failed" ? "bounced" : report.action === "delivered" ? "delivered" : report.action === "delayed" ? "delayed" : "relayed";
	await db.insert(messageTrackingEvents).values({ id: newId("evt"), messageId: message.id, type, at: now, detail });

	if (report.action === "failed") {
		await db
			.update(messages)
			.set({ deliveryStatus: "bounced", bouncedAt: message.bouncedAt ?? now, deliveryDetail: detail })
			.where(eq(messages.id, message.id));
		void dispatchWebhooks(env, message.userId, "message.bounced", { messageId: message.id, to: message.toAddr, detail }).catch(() => {});
	} else if (report.action === "delivered") {
		if (message.deliveryStatus !== "bounced") {
			await db
				.update(messages)
				.set({ deliveryStatus: "delivered", deliveredAt: message.deliveredAt ?? now })
				.where(eq(messages.id, message.id));
		}
	}
	return true;
}

// ---------- opens and clicks ----------

async function recomputeCounters(env: CloudflareEnv, messageId: string): Promise<void> {
	await env.DB.prepare(
		`UPDATE messages SET
			open_count = (SELECT count(*) FROM message_tracking_events WHERE message_id = ?1 AND type = 'open' AND ignored IS NULL),
			first_opened_at = (SELECT min(at) FROM message_tracking_events WHERE message_id = ?1 AND type = 'open' AND ignored IS NULL),
			last_opened_at = (SELECT max(at) FROM message_tracking_events WHERE message_id = ?1 AND type = 'open' AND ignored IS NULL),
			click_count = (SELECT count(*) FROM message_tracking_events WHERE message_id = ?1 AND type = 'click' AND ignored IS NULL),
			first_clicked_at = (SELECT min(at) FROM message_tracking_events WHERE message_id = ?1 AND type = 'click' AND ignored IS NULL),
			last_clicked_at = (SELECT max(at) FROM message_tracking_events WHERE message_id = ?1 AND type = 'click' AND ignored IS NULL)
		WHERE id = ?1`,
	)
		.bind(messageId)
		.run();
}

async function eventBudgetLeft(env: CloudflareEnv, messageId: string): Promise<boolean> {
	const count = await env.DB.prepare("SELECT count(*) AS n FROM message_tracking_events WHERE message_id = ?").bind(messageId).first<number>("n");
	return Number(count ?? 0) < MAX_EVENTS_PER_MESSAGE;
}

export type OpenResult = { known: boolean; counted?: boolean; ignored?: string | null };

/** Records a hit on the open pixel. Unknown tokens record nothing and return known=false. */
export async function recordOpen(env: CloudflareEnv, token: string, context: TrackingContext): Promise<OpenResult> {
	if (!token || token.length > 128) return { known: false };
	const db = getDb(env);
	const [message] = await db
		.select({
			id: messages.id,
			userId: messages.userId,
			subject: messages.subject,
			toAddr: messages.toAddr,
			sentAt: messages.sentAt,
			createdAt: messages.createdAt,
		})
		.from(messages)
		.where(eq(messages.trackingToken, token))
		.limit(1);
	if (!message) return { known: false };
	if (!(await eventBudgetLeft(env, message.id))) return { known: true, counted: false, ignored: "event_limit" };

	const now = context.now ?? new Date();
	const sent = message.sentAt ?? message.createdAt;
	let ignored: string | null = null;
	if (now.getTime() - sent.getTime() < OPEN_IGNORE_MS) ignored = "too_soon";
	else if (BOT_USER_AGENT.test(context.userAgent)) ignored = "bot_ua";
	else {
		const [previous] = await db
			.select({ at: messageTrackingEvents.at })
			.from(messageTrackingEvents)
			.where(
				and(
					eq(messageTrackingEvents.messageId, message.id),
					eq(messageTrackingEvents.type, "open"),
					isNull(messageTrackingEvents.ignored),
					eq(messageTrackingEvents.ipHash, context.ipHash),
				),
			)
			.orderBy(desc(messageTrackingEvents.at))
			.limit(1);
		if (previous && now.getTime() - previous.at.getTime() < OPEN_DEDUPE_MS) ignored = "duplicate";
	}

	const eventId = newId("evt");
	let isFirst = false;
	if (!ignored) {
		const [existing] = await db
			.select({ id: messageTrackingEvents.id })
			.from(messageTrackingEvents)
			.where(and(eq(messageTrackingEvents.messageId, message.id), eq(messageTrackingEvents.type, "open"), isNull(messageTrackingEvents.ignored)))
			.limit(1);
		isFirst = !existing;
	}
	await db.insert(messageTrackingEvents).values({
		id: eventId,
		messageId: message.id,
		type: "open",
		at: now,
		ignored,
		isFirst,
		userAgent: clip(context.userAgent, 200),
		ipHash: context.ipHash,
	});
	if (ignored) return { known: true, counted: false, ignored };

	await recomputeCounters(env, message.id);
	await markDelivered(env, message.id, "Opened (an open proves the mail reached the recipient)");
	if (isFirst) {
		void dispatchWebhooks(env, message.userId, "message.opened", { messageId: message.id, to: message.toAddr, at: now.toISOString() }).catch(() => {});
	}
	return { known: true, counted: true, ignored: null };
}

/** Read-only lookup of a tracked link's destination (used for HEAD requests, which record nothing). */
export async function lookupTrackedLink(env: CloudflareEnv, token: string, linkKey: string): Promise<string | null> {
	if (!token || token.length > 128 || !linkKey || linkKey.length > 64) return null;
	const db = getDb(env);
	const [row] = await db
		.select({ url: messageTrackingLinks.url })
		.from(messageTrackingLinks)
		.innerJoin(messages, eq(messageTrackingLinks.messageId, messages.id))
		.where(and(eq(messages.trackingToken, token), eq(messageTrackingLinks.linkKey, linkKey)))
		.limit(1);
	return row?.url ?? null;
}

export type ClickResult = { url: string | null; counted?: boolean; ignored?: string | null };

/**
 * Records a click and returns the URL to redirect to. The URL is looked up from the links stored for
 * this mail — never taken from the request — so this cannot be used as an open redirect.
 */
export async function recordClick(env: CloudflareEnv, token: string, linkKey: string, context: TrackingContext): Promise<ClickResult> {
	if (!token || token.length > 128 || !linkKey || linkKey.length > 64) return { url: null };
	const db = getDb(env);
	const [message] = await db
		.select({ id: messages.id, userId: messages.userId, toAddr: messages.toAddr, sentAt: messages.sentAt, createdAt: messages.createdAt })
		.from(messages)
		.where(eq(messages.trackingToken, token))
		.limit(1);
	if (!message) return { url: null };
	const [link] = await db
		.select()
		.from(messageTrackingLinks)
		.where(and(eq(messageTrackingLinks.messageId, message.id), eq(messageTrackingLinks.linkKey, linkKey)))
		.limit(1);
	if (!link) return { url: null };
	if (!(await eventBudgetLeft(env, message.id))) return { url: link.url, counted: false, ignored: "event_limit" };

	const now = context.now ?? new Date();
	const sent = message.sentAt ?? message.createdAt;
	let ignored: string | null = null;
	if (now.getTime() - sent.getTime() < CLICK_IGNORE_MS) ignored = "too_soon";
	else if (BOT_USER_AGENT.test(context.userAgent)) ignored = "bot_ua";

	const allLinks = await db.select({ id: messageTrackingLinks.id }).from(messageTrackingLinks).where(eq(messageTrackingLinks.messageId, message.id));
	if (!ignored && allLinks.length >= 2) {
		const windowStart = new Date(now.getTime() - SCANNER_BURST_MS);
		const recent = await db
			.select({ id: messageTrackingEvents.id, linkId: messageTrackingEvents.linkId })
			.from(messageTrackingEvents)
			.where(and(eq(messageTrackingEvents.messageId, message.id), eq(messageTrackingEvents.type, "click"), gt(messageTrackingEvents.at, windowStart)));
		const distinct = new Set(recent.map((event) => event.linkId).filter(Boolean));
		distinct.add(link.id);
		if (distinct.size >= allLinks.length) {
			ignored = "scanner_burst";
			// The earlier hits of the same burst were counted before we knew: take them back.
			await db
				.update(messageTrackingEvents)
				.set({ ignored: "scanner_burst", isFirst: false })
				.where(and(eq(messageTrackingEvents.messageId, message.id), eq(messageTrackingEvents.type, "click"), gt(messageTrackingEvents.at, windowStart), isNull(messageTrackingEvents.ignored)));
		}
	}

	let isFirst = false;
	if (!ignored) {
		const [existing] = await db
			.select({ id: messageTrackingEvents.id })
			.from(messageTrackingEvents)
			.where(and(eq(messageTrackingEvents.messageId, message.id), eq(messageTrackingEvents.type, "click"), isNull(messageTrackingEvents.ignored)))
			.limit(1);
		isFirst = !existing;
	}
	await db.insert(messageTrackingEvents).values({
		id: newId("evt"),
		messageId: message.id,
		type: "click",
		linkId: link.id,
		url: link.url,
		at: now,
		ignored,
		isFirst,
		userAgent: clip(context.userAgent, 200),
		ipHash: context.ipHash,
	});
	await recomputeCounters(env, message.id);
	if (ignored) return { url: link.url, counted: false, ignored };

	await markDelivered(env, message.id, "Clicked a link (a click proves the mail reached the recipient)");
	if (isFirst) {
		void dispatchWebhooks(env, message.userId, "message.clicked", { messageId: message.id, to: message.toAddr, url: link.url, at: now.toISOString() }).catch(() => {});
	}
	return { url: link.url, counted: true, ignored: null };
}

// ---------- reading ----------

export type TrackingSummary = {
	deliveryStatus: DeliveryStatus | null;
	deliveryDetail: string | null;
	sentAt: string | null;
	deliveredAt: string | null;
	bouncedAt: string | null;
	openCount: number;
	firstOpenedAt: string | null;
	lastOpenedAt: string | null;
	clickCount: number;
	firstClickedAt: string | null;
	lastClickedAt: string | null;
	tracked: boolean;
};

export type TrackingTimelineEvent = { id: string; type: string; at: string; url: string | null; detail: string | null };

export type TrackingDetail = {
	summary: TrackingSummary;
	events: TrackingTimelineEvent[];
	links: Array<{ url: string; clicks: number; lastClickedAt: string | null }>;
	ignoredHits: number;
};

export async function getTrackingDetail(env: CloudflareEnv, user: SessionUser, messageId: string): Promise<TrackingDetail | null> {
	const db = getDb(env);
	const [message] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
	if (!message || message.direction !== "outbound") return null;
	const accessible = await listAccessibleMailboxIds(db, user);
	const allowed = (message.mailboxId && accessible.includes(message.mailboxId)) || message.userId === user.id;
	if (!allowed) return null;

	const events = await db.select().from(messageTrackingEvents).where(eq(messageTrackingEvents.messageId, messageId)).orderBy(asc(messageTrackingEvents.at));
	const links = await db.select().from(messageTrackingLinks).where(eq(messageTrackingLinks.messageId, messageId));
	const counted = events.filter((event) => !event.ignored);
	const iso = (date: Date | null) => (date ? date.toISOString() : null);

	return {
		summary: {
			deliveryStatus: (message.deliveryStatus as DeliveryStatus | null) ?? null,
			deliveryDetail: message.deliveryDetail,
			sentAt: iso(message.sentAt),
			deliveredAt: iso(message.deliveredAt),
			bouncedAt: iso(message.bouncedAt),
			openCount: message.openCount,
			firstOpenedAt: iso(message.firstOpenedAt),
			lastOpenedAt: iso(message.lastOpenedAt),
			clickCount: message.clickCount,
			firstClickedAt: iso(message.firstClickedAt),
			lastClickedAt: iso(message.lastClickedAt),
			tracked: !!message.trackingToken,
		},
		events: counted.map((event) => ({ id: event.id, type: event.type, at: event.at.toISOString(), url: event.url, detail: event.detail })),
		links: links.map((link) => {
			const clicks = counted.filter((event) => event.type === "click" && event.linkId === link.id);
			return { url: link.url, clicks: clicks.length, lastClickedAt: clicks.length ? clicks[clicks.length - 1].at.toISOString() : null };
		}),
		ignoredHits: events.length - counted.length,
	};
}

export type TrackingNotification = { id: string; messageId: string; type: "open" | "click"; at: string; subject: string | null; to: string; url: string | null };

/** First counted open / first counted click of the mails this user can read, newer than `after`. */
export async function listTrackingNotifications(env: CloudflareEnv, user: SessionUser, after: Date): Promise<TrackingNotification[]> {
	const db = getDb(env);
	const mailboxIds = await listAccessibleMailboxIds(db, user);
	const ownership = mailboxIds.length ? or(eq(messages.userId, user.id), inArray(messages.mailboxId, mailboxIds)) : eq(messages.userId, user.id);
	const rows = await db
		.select({
			id: messageTrackingEvents.id,
			messageId: messageTrackingEvents.messageId,
			type: messageTrackingEvents.type,
			at: messageTrackingEvents.at,
			url: messageTrackingEvents.url,
			subject: messages.subject,
			to: messages.toAddr,
		})
		.from(messageTrackingEvents)
		.innerJoin(messages, eq(messageTrackingEvents.messageId, messages.id))
		.where(and(eq(messageTrackingEvents.isFirst, true), isNull(messageTrackingEvents.ignored), gt(messageTrackingEvents.at, after), ownership))
		.orderBy(asc(messageTrackingEvents.at))
		.limit(20);
	return rows
		.filter((row) => row.type === "open" || row.type === "click")
		.map((row) => ({ id: row.id, messageId: row.messageId, type: row.type as "open" | "click", at: row.at.toISOString(), subject: row.subject, to: row.to, url: row.url }));
}

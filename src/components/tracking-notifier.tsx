"use client";

import { useEffect } from "react";
import { authFetch } from "@/lib/auth/client";

const CURSOR_KEY = "trtmail:track-cursor";
const POLL_MS = 20_000;

type TrackingEvent = { id: string; messageId: string; type: "open" | "click"; at: string; subject: string | null; to: string; url: string | null };

function readCursor(): string {
	try {
		return window.localStorage.getItem(CURSOR_KEY) || new Date().toISOString();
	} catch {
		return new Date().toISOString();
	}
}

/** Polls for the first open / first click of the sender's mails and shows a toast (and OS notification if enabled). */
export function TrackingNotifier() {
	useEffect(() => {
		let cancelled = false;
		let cursor = readCursor();

		async function check() {
			if (document.hidden && !("Notification" in window)) return;
			try {
				const response = await authFetch(`/api/tracking/notifications?after=${encodeURIComponent(cursor)}`);
				if (!response.ok) return;
				const data = (await response.json()) as { events: TrackingEvent[]; now: string };
				if (cancelled) return;
				cursor = data.events.length ? data.events[data.events.length - 1].at : data.now;
				try {
					window.localStorage.setItem(CURSOR_KEY, cursor);
				} catch {
					/* ignore */
				}
				for (const event of data.events) {
					const subject = event.subject || "(no subject)";
					const detail =
						event.type === "open"
							? { title: "Your email was likely opened", body: `${subject} → ${event.to}` }
							: { title: "A link was clicked", body: `${event.to} clicked ${event.url ?? "a link"} · ${subject}` };
					window.dispatchEvent(new CustomEvent("trtmail:notify", { detail: { ...detail, href: `/sent/${event.messageId}` } }));
				}
			} catch {
				/* offline or signed out: try again next tick */
			}
		}

		const first = window.setTimeout(() => void check(), 3000);
		const timer = window.setInterval(() => void check(), POLL_MS);
		return () => {
			cancelled = true;
			window.clearTimeout(first);
			window.clearInterval(timer);
		};
	}, []);
	return null;
}

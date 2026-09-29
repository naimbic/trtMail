"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, X } from "lucide-react";
import { isDesktopEnabled, isSoundEnabled } from "@/lib/notification-prefs";

/**
 * New-mail toast + sound. Listens for the `trtmail:new-mail` event (dispatched by
 * useMessageCounts when the server-confirmed inbox unread count rises). Works on the
 * self-hosted deploy, which has no realtime push — detection is poll-based.
 * Also fires an OS notification when the tab is in the background.
 */

type Toast = { id: number; title: string; body?: string };

// Soft two-note "ding" via WebAudio — no audio asset to ship.
function playDing() {
	if (!isSoundEnabled()) return;
	try {
		const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!AC) return;
		const ctx = new AC();
		void ctx.resume?.();
		const t0 = ctx.currentTime;
		const notes: Array<[number, number, number]> = [
			[880, t0, 0.14], // A5
			[1174.66, t0 + 0.1, 0.2], // D6
		];
		for (const [freq, start, dur] of notes) {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "sine";
			osc.frequency.value = freq;
			gain.gain.setValueAtTime(0.0001, start);
			gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(start);
			osc.stop(start + dur + 0.02);
		}
		setTimeout(() => void ctx.close().catch(() => {}), 900);
	} catch {
		// Autoplay blocked or WebAudio unavailable — ignore.
	}
}

export function NotificationToaster() {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const lastFired = useRef(0);
	const idRef = useRef(0);

	useEffect(() => {
		function onNewMail(event: Event) {
			const now = Date.now();
			if (now - lastFired.current < 2000) return; // de-dupe multiple hook instances
			lastFired.current = now;
			const count = Math.max(1, Number((event as CustomEvent).detail?.count) || 1);
			const title = count > 1 ? `${count} new emails` : "New email";

			playDing();

			const id = ++idRef.current;
			setToasts((current) => [...current, { id, title, body: "Click to open your inbox" }]);
			setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 6000);

			try {
				if (
					isDesktopEnabled() &&
					typeof Notification !== "undefined" &&
					Notification.permission === "granted" &&
					document.visibilityState !== "visible"
				) {
					const n = new Notification(title, { body: "trtMail", icon: "/icon-96.png" });
					n.onclick = () => {
						window.focus();
						window.location.assign("/inbox");
						n.close();
					};
				}
			} catch {
				/* no-op */
			}
		}

		window.addEventListener("trtmail:new-mail", onNewMail);
		return () => window.removeEventListener("trtmail:new-mail", onNewMail);
	}, []);

	if (toasts.length === 0) return null;

	return (
		<div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
			{toasts.map((toast) => (
				<button
					key={toast.id}
					type="button"
					onClick={() => window.location.assign("/inbox")}
					className="pointer-events-auto flex w-72 items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-left shadow-lg transition hover:border-blue-300"
				>
					<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
						<Mail className="h-4 w-4" />
					</span>
					<span className="min-w-0 flex-1">
						<span className="block text-sm font-semibold text-neutral-900">{toast.title}</span>
						{toast.body && <span className="block truncate text-xs text-neutral-500">{toast.body}</span>}
					</span>
					<span
						role="button"
						aria-label="Dismiss"
						onClick={(ev) => {
							ev.stopPropagation();
							setToasts((current) => current.filter((t) => t.id !== toast.id));
						}}
					>
						<X className="h-4 w-4 shrink-0 text-neutral-400 hover:text-neutral-700" />
					</span>
				</button>
			))}
		</div>
	);
}

"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCheck, Clock, Eye, MousePointerClick } from "lucide-react";
import dayjs from "dayjs";
import { authFetch } from "@/lib/auth/client";
import type { Message } from "@/hooks/types";
import { TrackingChips } from "./tracking-chips";

type Detail = {
	summary: {
		deliveryStatus: string | null;
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
	events: Array<{ id: string; type: string; at: string; url: string | null; detail: string | null }>;
	links: Array<{ url: string; clicks: number; lastClickedAt: string | null }>;
	ignoredHits: number;
};

const EVENT_STYLE: Record<string, { label: string; Icon: typeof Check; tone: string }> = {
	accepted: { label: "Sent: accepted by the mail server", Icon: Check, tone: "text-neutral-500 bg-neutral-100" },
	delivered: { label: "Received", Icon: CheckCheck, tone: "text-emerald-700 bg-emerald-50" },
	relayed: { label: "Handed to another server", Icon: Check, tone: "text-neutral-500 bg-neutral-100" },
	delayed: { label: "Delivery delayed", Icon: Clock, tone: "text-amber-700 bg-amber-50" },
	bounced: { label: "Bounced", Icon: AlertTriangle, tone: "text-red-700 bg-red-50" },
	failed: { label: "Failed", Icon: AlertTriangle, tone: "text-red-700 bg-red-50" },
	open: { label: "Opened (likely)", Icon: Eye, tone: "text-sky-700 bg-sky-50" },
	click: { label: "Clicked", Icon: MousePointerClick, tone: "text-violet-700 bg-violet-50" },
};

/** Delivery and engagement timeline of one sent mail. */
export function TrackingTimeline({ message }: { message: Message }) {
	const [detail, setDetail] = useState<Detail | null>(null);
	const [error, setError] = useState(false);

	useEffect(() => {
		let cancelled = false;
		async function load() {
			try {
				const response = await authFetch(`/api/messages/${message.id}/tracking`);
				if (!response.ok) throw new Error("tracking unavailable");
				const data = (await response.json()) as Detail;
				if (!cancelled) setDetail(data);
			} catch {
				if (!cancelled) setError(true);
			}
		}
		void load();
		const timer = window.setInterval(() => void load(), 30_000);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [message.id]);

	if (error || !detail) return null;
	const merged: Message = { ...message, ...detail.summary, status: message.status } as Message;

	return (
		<section className="mb-6 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4" aria-label="Delivery and engagement">
			<div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
				<h2 className="text-sm font-semibold text-neutral-900">Delivery &amp; engagement</h2>
				<TrackingChips message={merged} />
			</div>

			<ol className="space-y-1.5">
				{detail.events.map((event) => {
					const style = EVENT_STYLE[event.type] ?? EVENT_STYLE.accepted;
					return (
						<li key={event.id} className="flex items-start gap-2.5 text-sm">
							<span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${style.tone}`}>
								<style.Icon className="h-3 w-3" />
							</span>
							<span className="min-w-0 flex-1">
								<span className="font-medium text-neutral-800">{style.label}</span>
								<span className="ml-2 text-xs tabular-nums text-neutral-500">{dayjs(event.at).format("MMM DD, YYYY HH:mm:ss")}</span>
								{event.type === "click" && event.url && (
									<span className="block truncate text-xs text-neutral-500" title={event.url}>
										{event.url}
									</span>
								)}
								{event.type !== "click" && event.detail && <span className="block break-words text-xs text-neutral-500">{event.detail}</span>}
							</span>
						</li>
					);
				})}
			</ol>

			{detail.links.some((link) => link.clicks > 0) && (
				<div className="mt-3 border-t border-neutral-200 pt-3">
					<p className="mb-1 text-xs font-medium text-neutral-600">Links clicked</p>
					<ul className="space-y-1">
						{detail.links
							.filter((link) => link.clicks > 0)
							.map((link) => (
								<li key={link.url} className="flex items-baseline justify-between gap-3 text-xs">
									<span className="min-w-0 truncate text-neutral-700" title={link.url}>
										{link.url}
									</span>
									<span className="shrink-0 tabular-nums text-neutral-500">{link.clicks}×</span>
								</li>
							))}
					</ul>
				</div>
			)}

			<ul className="mt-3 space-y-0.5 border-t border-neutral-200 pt-3 text-xs leading-5 text-neutral-500">
				{!detail.summary.tracked && <li>Opens and clicks are not tracked for this mail (plain text, tracking turned off, or no public address configured).</li>}
				<li>“Sent” means the outgoing mail server accepted it. “Received” appears only with proof: an open, a click or a delivery report. Whether it reached the inbox or the spam folder cannot be known.</li>
				{detail.summary.tracked && <li>Opens are an estimate (some mail apps load images by themselves, others block them). A click is the reliable signal.</li>}
				{detail.ignoredHits > 0 && <li>{detail.ignoredHits} automatic {detail.ignoredHits === 1 ? "hit" : "hits"} from mail servers or link scanners {detail.ignoredHits === 1 ? "was" : "were"} ignored.</li>}
			</ul>
		</section>
	);
}

"use client";

import { AlertTriangle, Check, CheckCheck, Eye, MousePointerClick } from "lucide-react";
import dayjs from "dayjs";
import type { Message } from "@/hooks/types";
import { formatMessageListTimestamp } from "@/components/messages/utils";

type Chip = { key: string; label: string; at: string | null; title: string; className: string; Icon: typeof Check };

function full(at: string | null | undefined) {
	return at ? dayjs(at).format("MMM DD, YYYY HH:mm:ss") : "";
}

export function getTrackingChips(message: Message): Chip[] {
	if (message.direction !== "outbound" || message.status === "draft" || message.status === "queued") return [];
	const chips: Chip[] = [];
	const failed = message.status === "failed" || message.deliveryStatus === "failed";
	const bounced = message.deliveryStatus === "bounced";

	if (failed) {
		chips.push({ key: "failed", label: "Failed", at: message.createdAt, title: `Not sent: ${message.deliveryDetail ?? "the mail server refused it"}`, className: "bg-red-50 text-red-700 ring-red-200", Icon: AlertTriangle });
	} else {
		const sentAt = message.sentAt ?? message.createdAt;
		chips.push({ key: "sent", label: "Sent", at: sentAt, title: `Accepted by the outgoing mail server ${full(sentAt)}`, className: "bg-neutral-100 text-neutral-700 ring-neutral-200", Icon: Check });
	}
	if (bounced) {
		chips.push({ key: "bounced", label: "Bounced", at: message.bouncedAt ?? null, title: `Bounced ${full(message.bouncedAt)}: ${message.deliveryDetail ?? "the recipient's server refused it"}`, className: "bg-red-50 text-red-700 ring-red-200", Icon: AlertTriangle });
	}
	if (message.deliveryStatus === "delivered") {
		chips.push({ key: "received", label: "Received", at: message.deliveredAt ?? null, title: "Confirmed received: it was opened or clicked, or the recipient's server returned a delivery report.", className: "bg-emerald-50 text-emerald-700 ring-emerald-200", Icon: CheckCheck });
	}
	if ((message.openCount ?? 0) > 0) {
		const n = message.openCount ?? 0;
		chips.push({ key: "opened", label: n > 1 ? `Opened ×${n}` : "Opened", at: message.firstOpenedAt ?? null, title: `Likely opened (first ${full(message.firstOpenedAt)}, last ${full(message.lastOpenedAt)}). Opens are an estimate: some mail apps load images by themselves, others block them.`, className: "bg-sky-50 text-sky-700 ring-sky-200", Icon: Eye });
	}
	if ((message.clickCount ?? 0) > 0) {
		const n = message.clickCount ?? 0;
		chips.push({ key: "clicked", label: n > 1 ? `Clicked ×${n}` : "Clicked", at: message.firstClickedAt ?? null, title: `Clicked a link (first ${full(message.firstClickedAt)}, last ${full(message.lastClickedAt)})`, className: "bg-violet-50 text-violet-700 ring-violet-200", Icon: MousePointerClick });
	}
	return chips;
}

/** Status chips for a sent mail: Sent, Received, Opened, Clicked, Bounced — each with its time. */
export function TrackingChips({ message, className = "" }: { message: Message; className?: string }) {
	const chips = getTrackingChips(message);
	if (chips.length === 0) return null;
	return (
		<span className={`flex flex-wrap items-center gap-1 ${className}`}>
			{chips.map(({ key, label, at, title, className: tone, Icon }) => (
				<span key={key} title={title} className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tone}`}>
					<Icon className="h-3 w-3" />
					{label}
					{at && <span className="font-normal opacity-75">· {formatMessageListTimestamp(at)}</span>}
				</span>
			))}
		</span>
	);
}

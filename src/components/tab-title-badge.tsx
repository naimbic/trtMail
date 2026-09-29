"use client";

import { useEffect, useRef } from "react";
import { useSelectedMailbox } from "@/components/mailbox-provider";
import { useMessageCounts } from "@/hooks/use-message-counts";

const BASE_TITLE = "trtMail";

/** Reflects inbox unread in the browser tab: "(3) trtMail" + a favicon count badge. */
export function TabTitleBadge() {
	const { selectedMailbox, isLoading } = useSelectedMailbox();
	const { counts } = useMessageCounts(selectedMailbox?.id, !isLoading);
	const unread = counts.folders.inbox.unread;
	const originalFavicon = useRef<string | null>(null);

	useEffect(() => {
		document.title = unread > 0 ? `(${unread}) ${BASE_TITLE}` : BASE_TITLE;
	}, [unread]);

	useEffect(() => {
		const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
		if (!link) return;
		if (originalFavicon.current === null) originalFavicon.current = link.href;

		if (unread <= 0) {
			if (originalFavicon.current) link.href = originalFavicon.current;
			return;
		}
		try {
			const size = 64;
			const canvas = document.createElement("canvas");
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			// Blue rounded badge with the count (or 9+).
			ctx.fillStyle = "#2563eb";
			ctx.beginPath();
			ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = "#ffffff";
			ctx.font = `bold ${unread > 9 ? 34 : 42}px -apple-system, Segoe UI, Roboto, sans-serif`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(unread > 9 ? "9+" : String(unread), size / 2, size / 2 + 2);
			link.href = canvas.toDataURL("image/png");
		} catch {
			/* leave favicon unchanged */
		}
	}, [unread]);

	return null;
}

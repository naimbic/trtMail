import { useEffect, useRef, useState } from "react";
import type { MessageCounts, MessageCountsDelta } from "./types";
import { clearMessageCountsCache, fetchMessageCounts } from "./utils";

const emptyCounts: MessageCounts = {
	folders: {
		inbox: { total: 0, unread: 0 },
		starred: { total: 0, unread: 0 },
		snoozed: { total: 0, unread: 0 },
		sent: { total: 0, unread: 0 },
		drafts: { total: 0, unread: 0 },
		archived: { total: 0, unread: 0 },
		spam: { total: 0, unread: 0 },
		trash: { total: 0, unread: 0 },
	},
	customFolders: {},
	mailboxes: [],
};

export function useMessageCounts(mailboxId?: string | null, enabled = true) {
	const [counts, setCounts] = useState<MessageCounts>(emptyCounts);
	const [isLoading, setIsLoading] = useState(enabled);
	// Track the last server-confirmed inbox unread count to detect new mail arriving
	// between polls (self-hosted has no realtime push — detection is poll-based).
	const prevUnread = useRef<number | null>(null);

	useEffect(() => {
		if (!enabled) {
			setIsLoading(false);
			return;
		}

		let cancelled = false;
		prevUnread.current = null; // reset baseline when the mailbox changes

		async function loadCounts(force = false) {
			setIsLoading(true);
			try {
				const nextCounts = await fetchMessageCounts(mailboxId, force);
				if (!cancelled) {
					const unread = nextCounts?.folders.inbox.unread ?? 0;
					// Fire once per real increase (skip the first load, which sets the baseline).
					if (prevUnread.current !== null && unread > prevUnread.current) {
						window.dispatchEvent(
							new CustomEvent("trtmail:new-mail", { detail: { count: unread - prevUnread.current } }),
						);
					}
					prevUnread.current = unread;
					setCounts(nextCounts ?? emptyCounts);
				}
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		}

		void loadCounts();
		function onMessagesChanged() {
			clearMessageCountsCache();
			void loadCounts(true);
		}
		function onMessageCountsDelta(event: Event) {
			const detail = (event as CustomEvent<MessageCountsDelta>).detail;
			if (!detail?.inboxUnreadDelta) return;
			const delta = detail.inboxUnreadDelta;
			setCounts((current) => ({
				...current,
				folders: {
					...current.folders,
					inbox: {
						...current.folders.inbox,
						unread: Math.max(0, current.folders.inbox.unread + delta),
					},
				},
			}));
		}
		window.addEventListener("trtmail:messages-changed", onMessagesChanged);
		window.addEventListener("trtmail:message-counts-changed", onMessagesChanged);
		window.addEventListener("trtmail:message-counts-delta", onMessageCountsDelta);
		const refreshInterval = window.setInterval(() => void loadCounts(true), 10_000);

		return () => {
			cancelled = true;
			window.removeEventListener("trtmail:messages-changed", onMessagesChanged);
			window.removeEventListener("trtmail:message-counts-changed", onMessagesChanged);
			window.removeEventListener("trtmail:message-counts-delta", onMessageCountsDelta);
			window.clearInterval(refreshInterval);
		};
	}, [enabled, mailboxId]);

	return { counts, isLoading };
}

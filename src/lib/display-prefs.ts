"use client";

import { useCallback, useEffect, useState } from "react";

// Per-viewer display preferences (localStorage), toggled from Settings → Appearance.

export type DisplayPrefs = {
	groupBySender: boolean;
	autoExpandUnread: boolean;
	senderAvatars: boolean;
	attachmentBadge: boolean;
	showPreview: boolean;
	unreadAccent: boolean;
	showSenderEmail: boolean;
	compactRows: boolean;
};

export const DEFAULT_DISPLAY_PREFS: DisplayPrefs = {
	groupBySender: true,
	autoExpandUnread: false,
	senderAvatars: true,
	attachmentBadge: true,
	showPreview: true,
	unreadAccent: true,
	showSenderEmail: true,
	compactRows: false,
};

const KEY = "trtmail:display-prefs";
const EVENT = "trtmail:display-prefs-changed";

function read(): DisplayPrefs {
	try {
		const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<DisplayPrefs>;
		// Older builds stored only the grouping switch under its own key.
		if (stored.groupBySender === undefined && localStorage.getItem("trtmail:group-by-sender") === "0") {
			stored.groupBySender = false;
		}
		return { ...DEFAULT_DISPLAY_PREFS, ...stored };
	} catch {
		return DEFAULT_DISPLAY_PREFS;
	}
}

export function useDisplayPrefs() {
	const [prefs, setPrefs] = useState<DisplayPrefs>(DEFAULT_DISPLAY_PREFS);

	useEffect(() => {
		const sync = () => setPrefs(read());
		sync();
		window.addEventListener(EVENT, sync);
		window.addEventListener("storage", sync);
		return () => {
			window.removeEventListener(EVENT, sync);
			window.removeEventListener("storage", sync);
		};
	}, []);

	const setPref = useCallback(<K extends keyof DisplayPrefs>(key: K, value: DisplayPrefs[K]) => {
		try {
			localStorage.setItem(KEY, JSON.stringify({ ...read(), [key]: value }));
		} catch {
			/* ignore */
		}
		window.dispatchEvent(new Event(EVENT));
	}, []);

	const reset = useCallback(() => {
		try {
			localStorage.removeItem(KEY);
			localStorage.removeItem("trtmail:group-by-sender");
		} catch {
			/* ignore */
		}
		window.dispatchEvent(new Event(EVENT));
	}, []);

	return { prefs, setPref, reset };
}

"use client";

import { useCallback, useEffect, useState } from "react";

type InstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
	listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
	window.addEventListener("beforeinstallprompt", (event) => {
		event.preventDefault();
		deferredPrompt = event as InstallPromptEvent;
		notify();
	});
	window.addEventListener("appinstalled", () => {
		deferredPrompt = null;
		notify();
	});
}

function isStandalone() {
	return (
		window.matchMedia("(display-mode: standalone)").matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	);
}

/** Install state for the "Install app" button: native prompt where supported, manual hint on iOS. */
export function useInstallApp() {
	const [, rerender] = useState(0);
	const [installed, setInstalled] = useState(false);
	const [ios, setIos] = useState(false);

	useEffect(() => {
		setInstalled(isStandalone());
		setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
		const update = () => {
			setInstalled(isStandalone());
			rerender((n) => n + 1);
		};
		listeners.add(update);
		return () => {
			listeners.delete(update);
		};
	}, []);

	const install = useCallback(async () => {
		if (!deferredPrompt) return;
		const event = deferredPrompt;
		deferredPrompt = null;
		await event.prompt();
		await event.userChoice.catch(() => undefined);
		notify();
	}, []);

	return { installed, canInstall: !installed && !!deferredPrompt, needsManualInstall: !installed && ios, install };
}

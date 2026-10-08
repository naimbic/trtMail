"use client";

import { Download } from "lucide-react";
import { useInstallApp } from "@/lib/pwa";
import { useSidebar } from "./sidebar-state";

/** Compact "Install app" button for the sidebar; renders nothing unless the browser can install the app. */
export function InstallAppButton() {
	const { canInstall, install } = useInstallApp();
	const { minimal } = useSidebar();
	if (!canInstall) return null;
	return (
		<button type="button" onClick={() => void install()} title="Install trtMail as an app" aria-label="Install app" className="mail-install-btn">
			<Download size={15} />
			{!minimal && <span>Install app</span>}
		</button>
	);
}

"use client";

import { Download, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallApp } from "@/lib/pwa";

export function InstallAppCard() {
	const { installed, canInstall, needsManualInstall, install } = useInstallApp();

	return (
		<div className="flex items-start justify-between gap-6">
			<div>
				<p className="text-sm font-medium text-neutral-900">Install trtMail as an app</p>
				<p className="mt-0.5 text-sm text-neutral-500">
					{installed
						? "trtMail is installed on this device."
						: needsManualInstall
							? "On iPhone/iPad: tap Share, then Add to Home Screen."
							: canInstall
								? "Opens in its own window with an app icon, like a desktop or phone app."
								: "Use your browser's menu (Install app / Add to Home screen) if the button is unavailable."}
				</p>
				{needsManualInstall && (
					<p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400">
						<Share className="h-3.5 w-3.5" /> Share <SquarePlus className="h-3.5 w-3.5" /> Add to Home Screen
					</p>
				)}
			</div>
			<Button type="button" size="sm" disabled={!canInstall} onClick={() => void install()}>
				<Download className="mr-1.5 h-4 w-4" />
				{installed ? "Installed" : "Install"}
			</Button>
		</div>
	);
}

"use client";

import { useEffect, useState } from "react";
import {
	isDesktopEnabled,
	isSoundEnabled,
	setDesktopEnabled,
	setSoundEnabled,
} from "@/lib/notification-prefs";

function Toggle({
	checked,
	onChange,
	disabled,
}: {
	checked: boolean;
	onChange: (next: boolean) => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			disabled={disabled}
			onClick={() => onChange(!checked)}
			className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
				checked ? "bg-blue-600" : "bg-neutral-300"
			}`}
		>
			<span
				className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
					checked ? "translate-x-5" : "translate-x-0.5"
				}`}
			/>
		</button>
	);
}

export function NotificationSettingsForm() {
	const [sound, setSound] = useState(true);
	const [desktop, setDesktop] = useState(false);
	const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

	useEffect(() => {
		setSound(isSoundEnabled());
		setDesktop(isDesktopEnabled());
		try {
			setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
		} catch {
			setPermission("unsupported");
		}
	}, []);

	function onSound(next: boolean) {
		setSound(next);
		setSoundEnabled(next);
	}

	async function onDesktop(next: boolean) {
		if (next && typeof Notification !== "undefined" && Notification.permission === "default") {
			try {
				const result = await Notification.requestPermission();
				setPermission(result);
				if (result !== "granted") {
					setDesktop(false);
					setDesktopEnabled(false);
					return;
				}
			} catch {
				/* ignore */
			}
		}
		setDesktop(next);
		setDesktopEnabled(next);
	}

	const permissionDenied = permission === "denied";

	return (
		<div className="space-y-6">
			<div className="flex items-start justify-between gap-6">
				<div>
					<p className="text-sm font-medium text-neutral-900">Sound</p>
					<p className="mt-0.5 text-sm text-neutral-500">Play a soft chime when new mail arrives.</p>
				</div>
				<Toggle checked={sound} onChange={onSound} />
			</div>

			<div className="flex items-start justify-between gap-6 border-t border-neutral-100 pt-6">
				<div>
					<p className="text-sm font-medium text-neutral-900">Desktop notifications</p>
					<p className="mt-0.5 text-sm text-neutral-500">
						Show an OS notification for new mail while trtMail is in the background.
					</p>
					{permissionDenied && (
						<p className="mt-1 text-xs text-amber-600">
							Notifications are blocked in your browser — enable them for this site in the browser settings.
						</p>
					)}
					{permission === "unsupported" && (
						<p className="mt-1 text-xs text-neutral-400">Your browser doesn’t support desktop notifications.</p>
					)}
				</div>
				<Toggle
					checked={desktop && permission === "granted"}
					onChange={onDesktop}
					disabled={permission === "unsupported" || permissionDenied}
				/>
			</div>
		</div>
	);
}

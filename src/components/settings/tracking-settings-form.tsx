"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { authFetch } from "@/lib/auth/client";

type TrackingSettings = { enabled: boolean; publicUrlConfigured: boolean; canChange: boolean };

export function TrackingSettingsForm() {
	const [settings, setSettings] = useState<TrackingSettings | null>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		void authFetch("/api/settings/tracking")
			.then((response) => response.json() as Promise<TrackingSettings>)
			.then(setSettings)
			.catch(() => setError("Could not load the tracking setting."));
	}, []);

	async function change(enabled: boolean) {
		if (!settings) return;
		setSaving(true);
		setError(null);
		try {
			const response = await authFetch("/api/settings/tracking", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ enabled }),
			});
			if (!response.ok) throw new Error("save failed");
			setSettings({ ...settings, enabled });
		} catch {
			setError("Could not save the setting.");
		} finally {
			setSaving(false);
		}
	}

	if (!settings) return <p className="text-sm text-neutral-500">{error ?? "Loading…"}</p>;

	return (
		<div className="space-y-6">
			<div className="flex items-start justify-between gap-6">
				<div>
					<p className="text-sm font-medium text-neutral-900">Track opens and clicks</p>
					<p className="mt-0.5 text-sm text-neutral-500">
						Adds a tiny image and link redirects to the HTML mails you send, so you can see when they were likely opened and which link was clicked. Plain-text mails, unsubscribe links and signature links are never touched.
					</p>
					{!settings.canChange && <p className="mt-1 text-xs text-neutral-400">Only an administrator can change this setting.</p>}
					{settings.enabled && !settings.publicUrlConfigured && (
						<p className="mt-1 text-xs text-amber-600">
							APP_URL is not set to the public address of this site, so tracking links cannot be created. Set APP_URL in Coolify.
						</p>
					)}
					{error && <p className="mt-1 text-xs text-red-600">{error}</p>}
				</div>
				<Switch checked={settings.enabled} onCheckedChange={(next) => void change(next)} disabled={!settings.canChange || saving} aria-label="Track opens and clicks" />
			</div>

			<div className="space-y-2 border-t border-neutral-100 pt-6 text-sm leading-6 text-neutral-600">
				<p className="font-medium text-neutral-900">What you can and cannot know</p>
				<ul className="list-disc space-y-1 pl-5">
					<li><strong>Sent</strong>: the outgoing mail server accepted the mail.</li>
					<li><strong>Received</strong>: shown only with proof, an open, a click or a delivery report from the recipient&apos;s server. Without proof it stays “Sent”. Whether a mail landed in the inbox or the spam folder cannot be known.</li>
					<li><strong>Bounced</strong>: shown when the bounce message reaches the connected mailbox. A server that never sends a bounce stays invisible.</li>
					<li><strong>Opened</strong> is an estimate: Apple Mail loads images by itself, Gmail loads them through its own proxy and some apps block images. Hits in the first seconds after sending are ignored because they come from mail servers.</li>
					<li><strong>Clicked</strong> is the reliable signal. Security scanners that click links right after delivery, or every link at once, are ignored.</li>
				</ul>
				<p className="text-xs text-neutral-400">Depending on where your recipients live, you may need to mention tracking in your privacy notice.</p>
			</div>
		</div>
	);
}

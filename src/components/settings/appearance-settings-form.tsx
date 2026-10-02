"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useDisplayPrefs } from "@/lib/display-prefs";
import type { DisplayPrefs } from "@/lib/display-prefs";

const options: Array<{ key: keyof DisplayPrefs; title: string; description: string }> = [
	{ key: "groupBySender", title: "Group emails by sender", description: "Show the newest email from each sender with a dropdown for earlier ones." },
	{ key: "autoExpandUnread", title: "Auto-open groups with unread mail", description: "Groups that contain unread emails start expanded; read groups stay collapsed." },
	{ key: "senderAvatars", title: "Sender avatars", description: "Show a coloured circle with the sender's initials." },
	{ key: "attachmentBadge", title: "Attachment badge", description: "Show a paperclip badge on emails that include files." },
	{ key: "showPreview", title: "Message preview", description: "Show a grey preview line under the subject." },
	{ key: "showSenderEmail", title: "Sender email address", description: "Show the sender's address next to their name on wide screens." },
	{ key: "unreadAccent", title: "Unread highlight", description: "White background with a blue bar for unread emails; read emails are dimmed." },
	{ key: "compactRows", title: "Compact rows", description: "Tighter spacing so more emails fit on screen." },
];

export function AppearanceSettingsForm() {
	const { prefs, setPref, reset } = useDisplayPrefs();

	return (
		<div className="space-y-6">
			{options.map((option, index) => (
				<div
					key={option.key}
					className={`flex items-start justify-between gap-6 ${index > 0 ? "border-t border-neutral-100 pt-6" : ""}`}
				>
					<div>
						<p className="text-sm font-medium text-neutral-900">{option.title}</p>
						<p className="mt-0.5 text-sm text-neutral-500">{option.description}</p>
					</div>
					<Switch
						checked={prefs[option.key]}
						onCheckedChange={(next) => setPref(option.key, next)}
						aria-label={option.title}
					/>
				</div>
			))}
			<div className="border-t border-neutral-100 pt-4">
				<Button type="button" variant="ghost" size="sm" onClick={reset}>
					Reset to defaults
				</Button>
			</div>
		</div>
	);
}

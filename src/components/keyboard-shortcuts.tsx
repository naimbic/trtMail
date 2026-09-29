"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCompose } from "@/components/compose/compose-context";

/** Global Gmail-style keyboard shortcuts. Message-level shortcuts (reply/archive)
 * live on the message view; these are the app-wide ones. */
const GO_TARGETS: Record<string, string> = {
	i: "/inbox",
	s: "/starred",
	t: "/sent",
	d: "/drafts",
	a: "/archived",
	c: "/contacts",
};

const HELP = [
	["c", "Compose"],
	["/", "Search"],
	["g then i", "Go to Inbox"],
	["g then s", "Go to Starred"],
	["g then t", "Go to Sent"],
	["g then d", "Go to Drafts"],
	["g then a", "Go to Archived"],
	["g then c", "Go to Contacts"],
	["?", "This help"],
	["Esc", "Close"],
];

function isTyping(target: EventTarget | null): boolean {
	const el = target as HTMLElement | null;
	if (!el) return false;
	const tag = el.tagName;
	return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function KeyboardShortcuts() {
	const router = useRouter();
	const { openComposer } = useCompose();
	const [helpOpen, setHelpOpen] = useState(false);
	const goPending = useRef(false);
	const goTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.metaKey || e.ctrlKey || e.altKey) return;

			// "/" focuses search even when not typing; Esc closes help / blurs.
			if (e.key === "Escape") {
				setHelpOpen(false);
				return;
			}
			if (isTyping(e.target)) return;

			if (goPending.current) {
				goPending.current = false;
				if (goTimer.current) clearTimeout(goTimer.current);
				const dest = GO_TARGETS[e.key.toLowerCase()];
				if (dest) {
					e.preventDefault();
					router.push(dest);
				}
				return;
			}

			switch (e.key) {
				case "c":
					e.preventDefault();
					openComposer();
					break;
				case "/": {
					e.preventDefault();
					const search = document.querySelector<HTMLInputElement>("input[data-mail-search]");
					search?.focus();
					break;
				}
				case "g":
					goPending.current = true;
					if (goTimer.current) clearTimeout(goTimer.current);
					goTimer.current = setTimeout(() => {
						goPending.current = false;
					}, 1200);
					break;
				case "?":
					e.preventDefault();
					setHelpOpen((o) => !o);
					break;
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [openComposer, router]);

	if (!helpOpen) return null;
	return (
		<div className="fixed inset-0 z-[110] flex items-center justify-center p-4" onClick={() => setHelpOpen(false)}>
			<div className="absolute inset-0 bg-black/40" />
			<div
				className="relative w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl"
				onClick={(e) => e.stopPropagation()}
			>
				<h2 className="mb-4 text-base font-semibold text-neutral-900">Keyboard shortcuts</h2>
				<div className="space-y-2">
					{HELP.map(([keys, label]) => (
						<div key={keys} className="flex items-center justify-between text-sm">
							<span className="text-neutral-600">{label}</span>
							<kbd className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-mono text-xs text-neutral-700">
								{keys}
							</kbd>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

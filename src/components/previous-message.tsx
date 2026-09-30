"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { linkify } from "@/lib/email/linkify";
import type { PreviousMessageProps } from "./previous-message-types";

// Strip the leading "> " quote markers email clients add, so nested replies read cleanly.
function stripQuoteMarkers(text: string): string {
	return text
		.split("\n")
		.map((line) => line.replace(/^\s*>+ ?/, ""))
		.join("\n")
		.trim();
}

export function PreviousMessage({ message }: PreviousMessageProps) {
	const [open, setOpen] = useState(false);
	const body = stripQuoteMarkers(message.content ?? "");

	return (
		<div className="text-sm">
			{!open ? (
				<button
					type="button"
					onClick={() => setOpen(true)}
					aria-label="Show quoted text"
					title="Show quoted text"
					className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
				>
					<MoreHorizontal className="h-4 w-4" />
				</button>
			) : (
				<div className="border-l-2 border-neutral-200 pl-4">
					<button
						type="button"
						onClick={() => setOpen(false)}
						className="mb-1 text-xs font-medium text-neutral-400 hover:text-neutral-600"
					>
						Hide quoted text
					</button>
					{message.dateLine && (
						<p className="mb-1 text-xs text-neutral-400">
							On {message.dateLine}, {message.direction === "sent" ? "you" : "they"} wrote:
						</p>
					)}
					{body && (
						<pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-neutral-600">
							{linkify(body)}
						</pre>
					)}
					{message.quotedContent.map((nested, index) => (
						<div key={`${nested.dateLine}-${nested.content.slice(0, 24)}-${index}`} className="mt-3">
							<PreviousMessage message={nested} />
						</div>
					))}
				</div>
			)}
		</div>
	);
}

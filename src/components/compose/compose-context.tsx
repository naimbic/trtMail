"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

type ComposeContextValue = {
	open: boolean;
	draftId: string | null;
	initialTo: string;
	replyToId: string | null;
	openComposer: () => void;
	openComposerWith: (to: string) => void;
	openDraftComposer: (draftId: string, replyToId?: string) => void;
	closeComposer: () => void;
};

const ComposeContext = createContext<ComposeContextValue | null>(null);

export function useCompose() {
	const ctx = useContext(ComposeContext);
	if (!ctx) throw new Error("useCompose must be used within ComposeProvider");
	return ctx;
}

export function ComposeProvider({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);
	const [draftId, setDraftId] = useState<string | null>(null);
	const [initialTo, setInitialTo] = useState("");
	// When the composer was opened as a reply, the message we're replying to — so we
	// can mark it "replied" only once the reply is actually SENT (not on open/cancel).
	const [replyToId, setReplyToId] = useState<string | null>(null);

	return (
		<ComposeContext.Provider
			value={{
				open,
				draftId,
				initialTo,
				replyToId,
				openComposer: () => {
					setDraftId(null);
					setInitialTo("");
					setReplyToId(null);
					setOpen(true);
				},
				openComposerWith: (to) => {
					setDraftId(null);
					setInitialTo(to);
					setReplyToId(null);
					setOpen(true);
				},
				openDraftComposer: (nextDraftId, nextReplyToId) => {
					setDraftId(nextDraftId);
					setInitialTo("");
					setReplyToId(nextReplyToId ?? null);
					setOpen(true);
				},
				closeComposer: () => {
					setOpen(false);
					setDraftId(null);
					setInitialTo("");
					setReplyToId(null);
				},
			}}
		>
			{children}
		</ComposeContext.Provider>
	);
}

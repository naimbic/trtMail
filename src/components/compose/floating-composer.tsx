"use client";

import { ComposeForm } from "@/components/compose/compose-form";
import { useCompose } from "@/components/compose/compose-context";

export function FloatingComposer() {
	const { open, draftId, initialTo, replyToId, closeComposer } = useCompose();
	if (!open) return null;
	return (
		<ComposeForm
			key={draftId ?? (initialTo ? `to:${initialTo}` : "new")}
			mode="popup"
			draftIdToLoad={draftId}
			initialTo={initialTo}
			replyToId={replyToId}
			onClose={closeComposer}
		/>
	);
}

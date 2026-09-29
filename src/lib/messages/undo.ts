import { authFetch } from "@/lib/auth/client";

/** Show the global Undo snackbar with a reversal callback. */
export function emitUndo(message: string, onUndo: () => Promise<void> | void): void {
	window.dispatchEvent(new CustomEvent("trtmail:undo", { detail: { message, onUndo } }));
}

/** Reverse a move (archive/trash/spam) by putting the messages back in the inbox. */
export async function moveMessagesToInbox(ids: string[]): Promise<void> {
	await authFetch("/api/messages/bulk", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ messageIds: ids, action: "inbox" }),
	});
	window.dispatchEvent(new Event("trtmail:messages-changed"));
}

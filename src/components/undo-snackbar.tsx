"use client";

import { useEffect, useRef, useState } from "react";

type UndoDetail = { message: string; onUndo: () => Promise<void> | void };
type Snack = { id: number; message: string; onUndo: () => Promise<void> | void };

/** Gmail-style "Message archived — Undo" snackbar. Driven by the `trtmail:undo`
 * event (see lib/messages/undo.ts). Auto-dismisses after a few seconds. */
export function UndoSnackbar() {
	const [snack, setSnack] = useState<Snack | null>(null);
	const [busy, setBusy] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const idRef = useRef(0);

	useEffect(() => {
		function onUndoEvent(event: Event) {
			const detail = (event as CustomEvent<UndoDetail>).detail;
			if (!detail?.message || typeof detail.onUndo !== "function") return;
			if (timer.current) clearTimeout(timer.current);
			const id = ++idRef.current;
			setSnack({ id, message: detail.message, onUndo: detail.onUndo });
			timer.current = setTimeout(() => setSnack((s) => (s?.id === id ? null : s)), 6000);
		}
		window.addEventListener("trtmail:undo", onUndoEvent);
		return () => {
			window.removeEventListener("trtmail:undo", onUndoEvent);
			if (timer.current) clearTimeout(timer.current);
		};
	}, []);

	if (!snack) return null;

	async function handleUndo() {
		if (!snack || busy) return;
		setBusy(true);
		try {
			await snack.onUndo();
		} finally {
			setBusy(false);
			setSnack(null);
		}
	}

	return (
		<div className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2">
			<div className="flex items-center gap-4 rounded-lg bg-neutral-900 py-2.5 pl-4 pr-2 text-sm text-white shadow-lg">
				<span>{snack.message}</span>
				<button
					type="button"
					onClick={() => void handleUndo()}
					disabled={busy}
					className="rounded-md px-3 py-1 font-semibold text-blue-300 hover:bg-white/10 disabled:opacity-60"
				>
					{busy ? "Undoing…" : "Undo"}
				</button>
			</div>
		</div>
	);
}

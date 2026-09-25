"use client";

import { useState } from "react";
import { FolderInput } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { authFetch } from "@/lib/auth/client";

type Folder = { id: string; name: string; color?: string };

/** Top-right "Move to folder" control for the message view — lists the mailbox's
 * custom folders and moves the message via the bulk API (action: "folder"). */
export function MoveToFolder({
	messageId,
	mailboxId,
	onMoved,
}: {
	messageId: string;
	mailboxId: string | null;
	onMoved?: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [folders, setFolders] = useState<Folder[] | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function toggle() {
		const next = !open;
		setOpen(next);
		if (next && folders === null && mailboxId) {
			try {
				const res = await authFetch(`/api/folders?mailboxId=${encodeURIComponent(mailboxId)}`);
				const data = (await res.json()) as { folders?: Folder[] };
				setFolders(data.folders ?? []);
			} catch {
				setFolders([]);
			}
		}
	}

	async function move(folderId: string) {
		setBusy(true);
		setError(null);
		try {
			const res = await authFetch(`/api/messages/bulk`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ messageIds: [messageId], action: "folder", folderId }),
			});
			if (!res.ok) throw new Error("move failed");
			setOpen(false);
			window.dispatchEvent(new Event("trtmail:messages-changed"));
			onMoved?.();
		} catch {
			setError("Could not move message");
		} finally {
			setBusy(false);
		}
	}

	if (!mailboxId) return null;

	return (
		<div className="relative">
			<Tooltip label="Move to folder">
				<Button type="button" variant="ghost" size="sm" aria-label="Move to folder" onClick={() => void toggle()}>
					<FolderInput className="h-5 w-5" />
				</Button>
			</Tooltip>
			{open && (
				<div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
					<p className="px-3 pb-1 pt-1 text-sm font-medium text-neutral-500">Move to folder</p>
					{folders === null && <p className="px-3 py-2 text-sm text-neutral-400">Loading…</p>}
					{folders?.length === 0 && <p className="px-3 py-2 text-sm text-neutral-400">No folders yet</p>}
					{folders?.map((folder) => (
						<button
							key={folder.id}
							type="button"
							disabled={busy}
							className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
							onClick={() => void move(folder.id)}
						>
							<span className="h-3 w-3 shrink-0 rounded-full" style={{ background: folder.color ?? "#2563eb" }} />
							{folder.name}
						</button>
					))}
					{error && <p className="px-3 py-1 text-xs text-red-600">{error}</p>}
				</div>
			)}
		</div>
	);
}

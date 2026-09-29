"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, ChevronDown, Folder, Mail, MailOpen, ShieldAlert, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useSelectedMailbox } from "@/components/mailbox-provider";
import { authFetch } from "@/lib/auth/client";
import type { BulkMessageAction } from "@/app/api/messages/bulk/types";
import type { BulkMessageToolbarProps } from "./types";

type Folder = { id: string; name: string; color?: string };

export function BulkMessageToolbar({
	selectedCount,
	hasUnreadSelection,
	hideSelectedCount = false,
	onAction,
	onMoveToFolder,
	onClearSelection,
	pending,
}: BulkMessageToolbarProps) {
	const { selectedMailbox } = useSelectedMailbox();
	const [open, setOpen] = useState(false);
	const [folders, setFolders] = useState<Folder[] | null>(null);
	const wrapRef = useRef<HTMLDivElement | null>(null);

	// Close on outside click / Escape — attached on the next tick so the opening
	// click doesn't immediately close it.
	useEffect(() => {
		if (!open) return;
		function onDocClick(e: MouseEvent) {
			if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false);
		}
		const id = window.setTimeout(() => {
			document.addEventListener("mousedown", onDocClick);
			document.addEventListener("keydown", onKey);
		}, 0);
		return () => {
			window.clearTimeout(id);
			document.removeEventListener("mousedown", onDocClick);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	function toggle() {
		const next = !open;
		setOpen(next);
		if (next && selectedMailbox?.id) {
			setFolders(null);
			authFetch(`/api/folders?mailboxId=${encodeURIComponent(selectedMailbox.id)}`)
				.then((res) => res.json() as Promise<{ folders?: Folder[] }>)
				.then((data) => setFolders(data.folders ?? []))
				.catch(() => setFolders([]));
		}
	}

	const itemCls =
		"flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50";

	return (
		<div className="flex min-w-0 items-center gap-2 text-neutral-600 w-full">
			{!hideSelectedCount && (
				<span className="mr-2 text-sm font-medium text-neutral-800">{selectedCount} selected</span>
			)}
			<Tooltip label="Archive">
				<Button variant="ghost" size="sm" onClick={() => onAction("archive")} disabled={pending} aria-label="Archive">
					<Archive className="h-4 w-4" />
				</Button>
			</Tooltip>
			<Tooltip label="Report spam">
				<Button variant="ghost" size="sm" onClick={() => onAction("spam")} disabled={pending} aria-label="Report spam">
					<ShieldAlert className="h-4 w-4" />
				</Button>
			</Tooltip>
			<Tooltip label="Delete">
				<Button variant="ghost" size="sm" onClick={() => onAction("trash")} disabled={pending} aria-label="Delete">
					<Trash2 className="h-4 w-4" />
				</Button>
			</Tooltip>
			<Tooltip label={hasUnreadSelection ? "Mark as read" : "Mark as unread"}>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => onAction(hasUnreadSelection ? "read" : "unread")}
					disabled={pending}
					aria-label={hasUnreadSelection ? "Mark as read" : "Mark as unread"}
				>
					{hasUnreadSelection ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
				</Button>
			</Tooltip>
			<span className="flex-1" />
			<div className="relative" ref={wrapRef}>
				<Button variant="ghost" size="sm" onClick={toggle} disabled={pending} aria-label="Move to" className="gap-1 text-xs font-medium">
					Move to <ChevronDown className="h-3.5 w-3.5" />
				</Button>
				{open && (
					<div className="absolute right-0 z-50 mt-2 max-h-72 w-56 overflow-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
						<button type="button" className={itemCls} disabled={pending} onClick={() => { setOpen(false); onAction("archive"); }}>
							<Archive className="h-4 w-4 text-neutral-500" /> Archived
						</button>
						<button type="button" className={itemCls} disabled={pending} onClick={() => { setOpen(false); onAction("spam"); }}>
							<ShieldAlert className="h-4 w-4 text-neutral-500" /> Spam
						</button>
						<button type="button" className={itemCls} disabled={pending} onClick={() => { setOpen(false); onAction("trash"); }}>
							<Trash2 className="h-4 w-4 text-neutral-500" /> Trash
						</button>
						<div className="my-1 border-t border-neutral-100" />
						<p className="px-3 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Folders</p>
						{folders === null && <p className="px-3 py-2 text-sm text-neutral-400">Loading…</p>}
						{folders?.length === 0 && <p className="px-3 py-2 text-sm text-neutral-400">No folders yet</p>}
						{folders?.map((folder) => (
							<button
								key={folder.id}
								type="button"
								className={itemCls}
								disabled={pending}
								onClick={() => { setOpen(false); onMoveToFolder(folder.id); }}
							>
								<Folder className="h-4 w-4" style={{ color: folder.color ?? "#2563eb" }} />
								{folder.name}
							</button>
						))}
					</div>
				)}
			</div>
			<Tooltip label="Clear selection">
				<Button variant="ghost" size="sm" onClick={onClearSelection} disabled={pending} aria-label="Clear selection">
					<X className="h-4 w-4" />
				</Button>
			</Tooltip>
		</div>
	);
}

export type { BulkMessageAction };

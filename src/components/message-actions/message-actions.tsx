"use client";

import { createElement, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
	Archive,
	Ban,
	BellOff,
	Folder,
	Mail,
	MailOpen,
	MoreVertical,
	Reply,
	ReplyAll,
	ShieldAlert,
	Star,
	Trash2,
} from "lucide-react";
import { useCompose } from "@/components/compose/compose-context";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { authFetch } from "@/lib/auth/client";
import { toggleMessageStar } from "@/components/messages/message-list-row-actions-utils";
import { emitUndo, moveMessagesToInbox } from "@/lib/messages/undo";
import type { BulkMessageAction } from "@/app/api/messages/bulk/types";
import type { MessageActionsProps } from "./types";
import {
	confirmTrashWithoutUnsubscribe,
	blockMessageContact,
	buildReplyAllCc,
	createReplyDraft,
	createTrashSenderRule,
	getMessageActionRedirect,
	getMoveMessageActions,
	openUnsubscribeUrl,
	runSingleMessageAction,
} from "./utils";

const UNDO_LABELS: Partial<Record<BulkMessageAction, string>> = {
	archive: "Message archived",
	trash: "Message moved to Trash",
	spam: "Message reported as spam",
};

type CustomFolder = { id: string; name: string; color?: string };

export function MessageActions({
	messageId,
	mailboxId,
	senderAddress,
	direction,
	status,
	read,
	unsubscribeUrl,
	subject,
	bodyText,
	ownAddress,
	toAddr,
	ccAddr,
	replied,
	starred: starredProp,
}: MessageActionsProps) {
	const router = useRouter();
	const { openDraftComposer } = useCompose();
	const [pendingAction, setPendingAction] = useState<
		BulkMessageAction | "unsubscribe" | "reply" | "block" | null
	>(null);
	const [error, setError] = useState<string | null>(null);
	const [moreOpen, setMoreOpen] = useState(false);
	const [starred, setStarred] = useState(Boolean(starredProp));
	const [folders, setFolders] = useState<CustomFolder[] | null>(null);
	const menuRef = useRef<HTMLDivElement | null>(null);

	// Close the ⋯ menu on outside click / Escape (attached next tick to avoid the
	// opening click closing it).
	useEffect(() => {
		if (!moreOpen) return;
		function onDocClick(e: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMoreOpen(false);
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") setMoreOpen(false);
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
	}, [moreOpen]);

	function openMore() {
		const next = !moreOpen;
		setMoreOpen(next);
		if (next && folders === null && mailboxId) {
			authFetch(`/api/folders?mailboxId=${encodeURIComponent(mailboxId)}`)
				.then((res) => res.json() as Promise<{ folders?: CustomFolder[] }>)
				.then((data) => setFolders(data.folders ?? []))
				.catch(() => setFolders([]));
		}
	}

	async function runAction(action: BulkMessageAction) {
		setMoreOpen(false);
		setPendingAction(action);
		setError(null);
		try {
			await runSingleMessageAction(messageId, action);
			const label = UNDO_LABELS[action];
			if (label) emitUndo(label, () => moveMessagesToInbox([messageId]));
			const redirect = getMessageActionRedirect(action, direction);
			if (redirect) router.push(redirect);
			router.refresh();
		} catch {
			setError("Could not update message");
		} finally {
			setPendingAction(null);
		}
	}

	async function moveToFolder(folderId: string) {
		setMoreOpen(false);
		setPendingAction("archive");
		try {
			const res = await authFetch(`/api/messages/bulk`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ messageIds: [messageId], action: "folder", folderId }),
			});
			if (!res.ok) throw new Error("move failed");
			window.dispatchEvent(new Event("trtmail:messages-changed"));
			router.push("/inbox");
			router.refresh();
		} catch {
			setError("Could not move message");
		} finally {
			setPendingAction(null);
		}
	}

	async function toggleStar() {
		try {
			const result = await toggleMessageStar(messageId);
			setStarred(result.starred);
		} catch {
			/* ignore */
		}
	}

	async function onUnsubscribe() {
		setMoreOpen(false);
		setError(null);
		if (unsubscribeUrl) {
			openUnsubscribeUrl(unsubscribeUrl);
			return;
		}
		if (!confirmTrashWithoutUnsubscribe()) return;
		setPendingAction("unsubscribe");
		if (!mailboxId) {
			setError("Could not create trash rule");
			setPendingAction(null);
			return;
		}
		try {
			await createTrashSenderRule({ mailboxId, senderAddress });
			await runAction("trash");
		} catch {
			setError("Could not create trash rule");
			setPendingAction(null);
		}
	}

	const replyAllCc = buildReplyAllCc({ toAddr, ccAddr, ownAddress, senderAddress });

	async function handleReply(cc?: string) {
		setPendingAction("reply");
		setError(null);
		try {
			const draftId = await createReplyDraft({ mailboxId, senderAddress, ownAddress, subject, bodyText, cc });
			openDraftComposer(draftId, messageId);
		} catch (replyError) {
			setError(replyError instanceof Error ? replyError.message : "Could not start reply");
		} finally {
			setPendingAction(null);
		}
	}

	async function onBlockContact() {
		setMoreOpen(false);
		setError(null);
		if (!mailboxId) {
			setError("Could not block contact");
			return;
		}
		setPendingAction("block");
		try {
			await blockMessageContact({ mailboxId, senderAddress });
			await runSingleMessageAction(messageId, "trash");
			router.push("/trash");
			router.refresh();
		} catch (blockError) {
			setError(blockError instanceof Error ? blockError.message : "Could not block contact");
		} finally {
			setPendingAction(null);
		}
	}

	const disabled = pendingAction !== null;
	const markAction: BulkMessageAction = read ? "unread" : "read";
	const moveActions = getMoveMessageActions(status, direction);
	const menuItem =
		"flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-400";

	return (
		<div className="flex items-center gap-1 text-neutral-600">
			{error && <span className="mr-1 text-xs text-red-600">{error}</span>}

			<Tooltip label={starred ? "Starred" : "Star"}>
				<Button type="button" variant="ghost" size="sm" aria-label={starred ? "Starred" : "Star"} onClick={() => void toggleStar()}>
					<Star className={`h-5 w-5 ${starred ? "fill-amber-400 text-amber-400" : ""}`} />
				</Button>
			</Tooltip>

			<Tooltip label="Reply">
				<Button type="button" variant="ghost" size="sm" aria-label="Reply" disabled={disabled} onClick={() => handleReply()}>
					<Reply className={`h-5 w-5 ${replied ? "text-blue-600" : ""}`} />
				</Button>
			</Tooltip>

			{replyAllCc && (
				<Tooltip label="Reply all">
					<Button type="button" variant="ghost" size="sm" aria-label="Reply all" disabled={disabled} onClick={() => handleReply(replyAllCc)}>
						<ReplyAll className={`h-5 w-5 ${replied ? "text-blue-600" : ""}`} />
					</Button>
				</Tooltip>
			)}

			<div className="relative" ref={menuRef}>
				<Tooltip label="More">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						aria-label="More"
						aria-expanded={moreOpen}
						disabled={disabled}
						onClick={openMore}
					>
						<MoreVertical className="h-5 w-5" />
					</Button>
				</Tooltip>
				{moreOpen && (
					<div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-60 overflow-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
						<button type="button" className={menuItem} disabled={status === "trash"} onClick={() => void runAction("trash")}>
							<Trash2 className="h-4 w-4 shrink-0" /> Delete
						</button>
						<button type="button" className={menuItem} onClick={() => void runAction(markAction)}>
							{read ? <Mail className="h-4 w-4 shrink-0" /> : <MailOpen className="h-4 w-4 shrink-0" />}
							{read ? "Mark as unread" : "Mark as read"}
						</button>
						<button type="button" className={menuItem} disabled={status === "archived"} onClick={() => void runAction("archive")}>
							<Archive className="h-4 w-4 shrink-0" /> Archive
						</button>
						{direction === "inbound" && (
							<>
								<hr className="my-1 border-neutral-100" />
								<button
									type="button"
									className={menuItem}
									disabled={status === "spam"}
									onClick={() => void runAction("spam")}
								>
									<ShieldAlert className="h-4 w-4 shrink-0" /> Report spam
								</button>
								<button
									type="button"
									className={menuItem}
									disabled={!unsubscribeUrl && status === "trash"}
									onClick={() => void onUnsubscribe()}
								>
									<BellOff className="h-4 w-4 shrink-0" /> Unsubscribe
								</button>
								<button type="button" className={menuItem} onClick={() => void onBlockContact()}>
									<Ban className="h-4 w-4 shrink-0" /> Block contact
								</button>
							</>
						)}
						<hr className="my-1 border-neutral-100" />
						<p className="px-3 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Move to</p>
						{moveActions.map((item) => (
							<button key={item.action} type="button" className={menuItem} onClick={() => void runAction(item.action)}>
								{createElement(item.icon, { size: 16 })}
								{item.label}
							</button>
						))}
						{folders === null && <p className="px-3 py-1.5 text-sm text-neutral-400">Loading folders…</p>}
						{folders?.map((folder) => (
							<button key={folder.id} type="button" className={menuItem} onClick={() => void moveToFolder(folder.id)}>
								<Folder className="h-4 w-4 shrink-0" style={{ color: folder.color ?? "#2563eb" }} />
								{folder.name}
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

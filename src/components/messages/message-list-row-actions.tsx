"use client";

import { useState } from "react";
import { Archive, Clock, Mail, MailOpen, Reply, ReplyAll, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { useCompose } from "@/components/compose/compose-context";
import { buildReplyAllCc, createReplyDraft } from "@/components/message-actions/utils";
import type { MessageListRowActionsProps } from "./types";
import { getSnoozePresets, isMessageSnoozed, snoozeMessage, unsnoozeMessage } from "./message-list-row-actions-utils";

export function MessageListRowActions({ message, onAction }: MessageListRowActionsProps) {
	const { openDraftComposer } = useCompose();
	const [snoozeOpen, setSnoozeOpen] = useState(false);
	const [snoozedUntil, setSnoozedUntil] = useState(() => getSnoozePresets()[0].value);
	const [snoozing, setSnoozing] = useState(false);
	const [replying, setReplying] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const snoozePresets = getSnoozePresets();
	const snoozed = isMessageSnoozed(message.snoozedUntil);
	const readAction = message.read ? "unread" : "read";
	// Rows with actions are inbound inbox/snoozed messages: reply goes to the sender,
	// and we are the recipient (toAddr).
	const replyAllCc = buildReplyAllCc({
		toAddr: message.toAddr,
		ccAddr: message.ccAddr,
		ownAddress: message.toAddr,
		senderAddress: message.fromAddr,
	});

	async function handleReply(cc?: string) {
		setReplying(true);
		setError(null);
		try {
			const draftId = await createReplyDraft({
				mailboxId: message.mailboxId,
				senderAddress: message.fromAddr,
				ownAddress: message.toAddr,
				subject: message.subject,
				bodyText: message.textBody ?? message.snippet,
				cc,
			});
			openDraftComposer(draftId);
		} catch (replyError) {
			setError(replyError instanceof Error ? replyError.message : "Could not start reply");
		} finally {
			setReplying(false);
		}
	}
	// Color the snooze clock by status: blue = snoozed/upcoming, red = past its snooze time.
	const snoozeAt = message.snoozedUntil ? new Date(message.snoozedUntil).getTime() : null;
	const snoozeColor = snoozeAt ? (snoozeAt < Date.now() ? "text-red-500" : "text-blue-500") : "";

	async function handleSnooze() {
		setSnoozing(true);
		setError(null);
		try {
			await snoozeMessage(message.id, snoozedUntil);
			setSnoozeOpen(false);
		} catch (nextError) {
			setError(nextError instanceof Error ? nextError.message : "Unable to snooze message");
		} finally {
			setSnoozing(false);
		}
	}

	return (
		<>
			<div className="pointer-events-none absolute right-4 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5 rounded-full border border-neutral-200 bg-white px-1 opacity-0 shadow-sm transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
				<Tooltip label="Reply">
					<Button type="button" variant="ghost" size="sm" disabled={replying} onClick={() => void handleReply()} aria-label="Reply">
						<Reply className="h-4 w-4" />
					</Button>
				</Tooltip>
				{replyAllCc && (
					<Tooltip label="Reply all">
						<Button type="button" variant="ghost" size="sm" disabled={replying} onClick={() => void handleReply(replyAllCc)} aria-label="Reply all">
							<ReplyAll className="h-4 w-4" />
						</Button>
					</Tooltip>
				)}
				<span className="mx-0.5 h-5 w-px bg-neutral-200" />
				<Tooltip label="Archive">
					<Button type="button" variant="ghost" size="sm" onClick={() => void onAction("archive")} aria-label="Archive">
						<Archive className="h-4 w-4" />
					</Button>
				</Tooltip>
				<Tooltip label="Trash">
					<Button type="button" variant="ghost" size="sm" onClick={() => void onAction("trash")} aria-label="Trash">
						<Trash2 className="h-4 w-4" />
					</Button>
				</Tooltip>
				<Tooltip label={readAction === "read" ? "Mark as read" : "Mark as unread"}>
					<Button type="button" variant="ghost" size="sm" onClick={() => void onAction(readAction)} aria-label={readAction === "read" ? "Mark as read" : "Mark as unread"}>
						{readAction === "read" ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
					</Button>
				</Tooltip>
				<Tooltip label={snoozed ? "Unsnooze" : "Snooze"}>
					<Button type="button" variant="ghost" size="sm" onClick={() => {
						if (snoozed) {
							void unsnoozeMessage(message.id);
							return;
						}
						setSnoozeOpen(true);
					}} aria-label={snoozed ? "Unsnooze" : "Snooze"}>
						<Clock className={`h-4 w-4 ${snoozeColor}`} />
					</Button>
				</Tooltip>
			</div>

			<Dialog open={snoozeOpen} onOpenChange={setSnoozeOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Snooze email</DialogTitle>
						<DialogDescription>Hide this email from the inbox until the time you choose.</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="grid gap-2 sm:grid-cols-3">
							{snoozePresets.map((preset) => (
								<Button key={preset.label} type="button" variant="outline" size="sm" onClick={() => setSnoozedUntil(preset.value)}>
									{preset.label}
								</Button>
							))}
						</div>
						<div className="space-y-2">
							<label htmlFor={`snooze-until-${message.id}`} className="text-sm font-medium text-neutral-700">Select date and time</label>
							<Input id={`snooze-until-${message.id}`} type="datetime-local" value={snoozedUntil} onChange={(event) => setSnoozedUntil(event.target.value)} />
						</div>
						{error && <p className="text-sm text-red-600">{error}</p>}
						<Button type="button" onClick={() => void handleSnooze()} disabled={snoozing}>
							{snoozing ? "Snoozing..." : "Snooze"}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}

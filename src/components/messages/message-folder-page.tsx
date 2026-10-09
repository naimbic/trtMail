"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Layers, ListFilter, Inbox, Paperclip, Pin, Reply, Star, Trash2 } from "lucide-react";
import { getEmailAddress } from "@/lib/email/address";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip } from "@/components/ui/tooltip";
import { useCompose } from "@/components/compose/compose-context";
import { useMailSearch } from "@/components/mail-search/mail-search-context";
import { useSelectedMailbox } from "@/components/mailbox-provider";
import { usePageLoading } from "@/components/page-loading";
import { useMessageCounts } from "@/hooks/use-message-counts";
import { useMessages } from "@/hooks/use-messages";
import { useDisplayPrefs } from "@/lib/display-prefs";
import type { DisplayPrefs } from "@/lib/display-prefs";
import type { BulkMessageAction } from "@/app/api/messages/bulk/types";
import { setMessageDragData } from "@/lib/messages/drag-utils";
import { emitUndo, moveMessagesToInbox } from "@/lib/messages/undo";
import { BulkMessageToolbar } from "./bulk-message-toolbar";
import { MessageListRowActions } from "./message-list-row-actions";
import { dispatchMessageCountsDelta, toggleMessagePin, toggleMessageStar } from "./message-list-row-actions-utils";
import { MessageNavigationProgress, useMessageNavigation } from "./message-navigation";
import type { Message } from "@/hooks/types";
import type { MessageFolderConfig, MessageFolderPageProps, MessageGroupInfo, MessageListRowProps } from "./types";
import {
	formatMessageListTimestamp,
	getPageRange,
	getMessageParty,
	getMessagePartyClassName,
	getMessagePreview,
	formatEmailPageTitle,
	getMailboxAddress,
	runBulkMessageAction,
} from "./utils";

const pageSize = 20;

function AttachmentBadge() {
	return (
		<span
			className="inline-flex shrink-0 items-center rounded-full bg-indigo-50 p-1 text-indigo-600 ring-1 ring-indigo-100"
			title="Has attachment"
		>
			<Paperclip className="h-3 w-3" aria-label="Has attachment" />
		</span>
	);
}

const avatarColors = [
	"bg-blue-100 text-blue-700",
	"bg-emerald-100 text-emerald-700",
	"bg-amber-100 text-amber-700",
	"bg-rose-100 text-rose-700",
	"bg-violet-100 text-violet-700",
	"bg-cyan-100 text-cyan-700",
	"bg-orange-100 text-orange-700",
];

function SenderAvatar({ name, seed, selected = false, onToggle }: { name: string; seed: string; selected?: boolean; onToggle?: () => void }) {
	const letters = name
		.replace(/[^\p{L}\p{N}\s]/gu, "")
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
	let hash = 0;
	for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	return (
		<span
			role="checkbox"
			aria-checked={selected}
			aria-label={selected ? "Deselect" : "Select"}
			onClick={(event) => {
				// On phones the avatar doubles as the selection checkbox.
				if (!onToggle || !window.matchMedia("(max-width: 767px)").matches) return;
				event.preventDefault();
				event.stopPropagation();
				onToggle();
			}}
			className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors md:h-9 md:w-9 ${
				selected ? "bg-blue-600 text-white max-md:ring-2 max-md:ring-blue-200" : avatarColors[hash % avatarColors.length]
			}`}
		>
			{selected ? <Check className="h-5 w-5 md:hidden" /> : null}
			<span className={selected ? "max-md:hidden" : ""}>{letters || "?"}</span>
		</span>
	);
}

function getRowTone({ nested, groupOpen, unread, highlighted, unreadAccent }: { nested: boolean; groupOpen: boolean; unread: boolean; highlighted: boolean; unreadAccent: boolean }) {
	if (highlighted) return "border-l-4 border-l-blue-600 bg-blue-100/70";
	if (nested) return "border-l-4 border-l-slate-300 bg-slate-100 hover:bg-slate-200/70";
	if (groupOpen) return "border-l-4 border-l-blue-600 bg-sky-50 hover:bg-sky-100/70";
	if (!unreadAccent) return "border-l-4 border-l-transparent bg-white hover:bg-slate-50";
	if (unread) return "border-l-4 border-l-blue-500 bg-white hover:bg-blue-50/60";
	return "border-l-4 border-l-transparent bg-slate-50/80 hover:bg-white";
}

function GroupToggle({ group }: { group: MessageGroupInfo }) {
	const more = group.count - 1;
	return (
		<button
			type="button"
			aria-expanded={group.expanded}
			aria-label={group.expanded ? "Hide earlier emails" : `Show ${more} earlier emails from this sender`}
			onClick={(event) => {
				event.preventDefault();
				event.stopPropagation();
				group.onToggle();
			}}
			className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold shadow-sm transition-colors ${
				group.expanded
					? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
					: group.unreadCount > 0
						? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
						: "border-neutral-300 bg-white text-neutral-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
			}`}
		>
			{group.expanded ? "Hide" : `+${more} earlier`}
			<ChevronDown className={`h-3.5 w-3.5 transition-transform ${group.expanded ? "rotate-180" : ""}`} />
		</button>
	);
}

function getSenderKey(message: Message, folder: MessageFolderConfig["folder"]) {
	const address = folder === "sent" ? message.toAddr : message.fromAddr;
	return (address ? getEmailAddress(address) : "").toLowerCase();
}

/** Groups messages by sender; groups keep the position of their newest message. */
function groupMessagesBySender(messages: Message[], folder: MessageFolderConfig["folder"]) {
	const groups: Array<{ key: string; messages: Message[] }> = [];
	const index = new Map<string, number>();
	for (const message of messages) {
		const key = getSenderKey(message, folder);
		if (!key) {
			groups.push({ key: message.id, messages: [message] });
			continue;
		}
		const at = index.get(key);
		if (at === undefined) {
			index.set(key, groups.length);
			groups.push({ key, messages: [message] });
		} else {
			groups[at].messages.push(message);
		}
	}
	return groups;
}

function MessageListRow({
	message,
	config,
	selected,
	active = false,
	compact = false,
	currentAccountName,
	onSelectedChange,
	onMessageAction,
	dragMessageIds,
	group,
	nested = false,
	prefs,
}: MessageListRowProps & { prefs: DisplayPrefs }) {
	const Icon = config.icon;
	const { openDraftComposer } = useCompose();
	const [read, setRead] = useState(message.read);
	const [starred, setStarred] = useState(message.starred);
	const [pinned, setPinned] = useState(Boolean(message.pinned));
	useEffect(() => setRead(message.read), [message.read]);
	useEffect(() => setStarred(message.starred), [message.starred]);
	useEffect(() => setPinned(Boolean(message.pinned)), [message.pinned]);
	const rowMessage = { ...message, read, starred, pinned };
	const unread = rowMessage.direction === "inbound" && !rowMessage.read;
	const draggable = config.folder === "inbox" && message.direction === "inbound";
	const party = getMessageParty(rowMessage, config.folder, currentAccountName);
	const partyEmail = getEmailAddress(
		config.folder === "sent" || config.folder === "drafts" ? message.toAddr : message.fromAddr,
	);
	const showPartyEmail = !!partyEmail && partyEmail.toLowerCase() !== party.toLowerCase();
	const preview = getMessagePreview(rowMessage, config.folder);
	const href = `${config.hrefPrefix}/${message.id}`;
	const navigation = useMessageNavigation(href, rowMessage);

	function onMessageNavigate(event: MouseEvent<HTMLAnchorElement>) {
		if (unread && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
			setRead(true);
			dispatchMessageCountsDelta({ inboxUnreadDelta: -1 });
			void runBulkMessageAction([message.id], "read", false).catch(() => {
				setRead(false);
				dispatchMessageCountsDelta({ inboxUnreadDelta: 1 });
			});
		}
		navigation.onNavigate(event, unread);
	}

	if (compact && config.folder !== "drafts") {
		return (
			<div
				className={`group relative grid grid-cols-[20px_minmax(0,1fr)] gap-3 py-3 pr-4 transition-colors ${nested ? "pl-8" : "pl-4"} ${getRowTone({
					nested,
					groupOpen: !!group?.expanded,
					unread,
					highlighted: active || selected,
					unreadAccent: prefs.unreadAccent,
				})} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
				draggable={draggable}
				onDragStart={(event) => {
					if (!draggable) return;
					setMessageDragData(event.dataTransfer, { messageIds: dragMessageIds });
				}}
			>
				<MessageNavigationProgress progress={navigation.progress} />
				<Checkbox
					checked={selected}
					onChange={(event) => onSelectedChange(message.id, event.target.checked, group?.messageIds)}
					className="mt-1 h-4 w-4 rounded border-neutral-300"
					aria-label={`Select message from ${party}`}
				/>
				<Link href={href} onClick={onMessageNavigate} className="min-w-0">
					<span className="flex items-baseline justify-between gap-3">
						<span className="flex min-w-0 items-center gap-1.5">
							<span className={getMessagePartyClassName(message, config.folder)}>
								{party}
							</span>
							{group && group.count > 1 && <GroupToggle group={group} />}
							{prefs.attachmentBadge && group?.hasAttachments && !rowMessage.hasAttachments && <AttachmentBadge />}
						</span>
						<span className="shrink-0 text-[11px] text-neutral-400">
							{formatMessageListTimestamp(message.createdAt)}
						</span>
					</span>
					<span
						className={`mt-1 block truncate text-sm ${
							unread ? "font-semibold text-neutral-900" : "text-neutral-700"
						}`}
					>
						{prefs.attachmentBadge && rowMessage.hasAttachments && (
							<Paperclip className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-indigo-600" aria-label="Has attachment" />
						)}
						{rowMessage.replied && (
							<Reply className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-blue-600" aria-label="Replied" />
						)}
						{message.subject ?? "(no subject)"}
					</span>
					{prefs.showPreview && (
						<span className="mt-0.5 block truncate text-xs leading-5 text-neutral-500">
							{preview}
						</span>
					)}
				</Link>
				<div className="pointer-events-none absolute right-2 top-1 z-10 flex items-center gap-px rounded-full border border-neutral-200 bg-white px-0.5 opacity-0 shadow-sm [&_button]:h-6 [&_button]:w-6 [&_button]:min-w-0 [&_button]:p-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
					<Tooltip label={pinned ? "Unpin" : "Pin"}>
						<Button type="button" variant="ghost" size="sm" aria-label={pinned ? "Unpin" : "Pin"} onClick={() => void toggleMessagePin(message.id).then((r) => setPinned(r.pinned))}>
							<Pin className={`h-3.5 w-3.5 ${pinned ? "fill-blue-500 text-blue-500" : ""}`} />
						</Button>
					</Tooltip>
					<Tooltip label={starred ? "Unstar" : "Star"}>
						<Button type="button" variant="ghost" size="sm" aria-label={starred ? "Unstar" : "Star"} onClick={() => void toggleMessageStar(message.id).then((r) => setStarred(r.starred))}>
							<Star className={`h-3.5 w-3.5 ${starred ? "fill-amber-400 text-amber-400" : ""}`} />
						</Button>
					</Tooltip>
					<Tooltip label="Delete">
						<Button type="button" variant="ghost" size="sm" aria-label="Delete" onClick={() => void onMessageAction(message.id, "trash").then(() => emitUndo("Message moved to Trash", () => moveMessagesToInbox([message.id])))}>
							<Trash2 className="h-3.5 w-3.5" />
						</Button>
					</Tooltip>
				</div>
			</div>
		);
	}

	const className = `group relative flex w-full items-start gap-2.5 md:gap-3 ${prefs.compactRows ? "min-h-[56px] py-1.5" : "min-h-[76px] py-3"} pr-3 md:pr-5 text-left text-sm transition-colors ${nested ? "pl-3 md:pl-6" : "pl-3 md:pl-4"} ${getRowTone({
		nested,
		groupOpen: !!group?.expanded,
		unread,
		highlighted: active || selected,
		unreadAccent: prefs.unreadAccent,
	})} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`;
	const content = (
		<>
			<span className="mt-1 shrink-0 max-md:hidden">
				{config.folder === "inbox" && message.direction === "inbound" ? (
					<Tooltip label={starred ? "Starred" : "Not starred"}>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								void toggleMessageStar(message.id).then((result) => setStarred(result.starred));
							}}
							aria-label={starred ? "Starred" : "Not starred"}
						>
							<Icon className={`h-4 w-4 ${starred ? "fill-amber-400 text-amber-400" : "text-neutral-300"}`} />
						</Button>
					</Tooltip>
				) : (
					<Icon className="h-4 w-4 text-neutral-300" />
				)}
			</span>
			{!prefs.senderAvatars ? null : nested ? <span className="w-10 shrink-0 md:w-9" /> : <SenderAvatar name={party} seed={partyEmail || party} selected={selected} onToggle={() => onSelectedChange(message.id, !selected, group?.messageIds)} />}
			<span className="min-w-0 flex-1">
				{/* Line 1 — sender, address, markers, group toggle */}
				<span className="flex items-center gap-2">
					<span className={`truncate text-[15px] ${unread ? "font-bold text-neutral-900" : "font-medium text-neutral-700"}`}>
						{party}
					</span>
					{prefs.showSenderEmail && showPartyEmail && !nested && <span className="hidden truncate text-xs text-neutral-400 xl:inline">{partyEmail}</span>}
					{rowMessage.replied && (
						<Reply className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-label="Replied" />
					)}
					{prefs.attachmentBadge && (rowMessage.hasAttachments || group?.hasAttachments) && <AttachmentBadge />}
					{group && group.count > 1 && <GroupToggle group={group} />}
				</span>
				{/* Line 2 — subject */}
				<span className={`mt-0.5 block truncate text-sm ${unread ? "font-semibold text-neutral-900" : "text-neutral-700"}`}>
					{rowMessage.subject ?? "(no subject)"}
				</span>
				{/* Line 3 — preview */}
				{prefs.showPreview && <span className="block truncate text-[13px] leading-5 text-neutral-500">{preview}</span>}
			</span>
			<span className="flex shrink-0 flex-col items-end gap-1">
				<span
					className={`mt-0.5 text-[11px] tabular-nums md:text-xs md:group-hover:opacity-0 ${
						unread ? "font-semibold text-blue-700" : "text-neutral-500"
					}`}
				>
					{formatMessageListTimestamp(message.createdAt)}
				</span>
				{config.folder === "inbox" && message.direction === "inbound" && (
					<button
						type="button"
						aria-label={starred ? "Starred" : "Not starred"}
						onClick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							void toggleMessageStar(message.id).then((result) => setStarred(result.starred));
						}}
						className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full md:hidden"
					>
						<Star className={`h-[18px] w-[18px] ${starred ? "fill-amber-400 text-amber-400" : "text-neutral-300"}`} />
					</button>
				)}
			</span>
		</>
	);

	if (config.folder === "drafts") {
		return (
			<div className={className}>
				<Checkbox
					checked={selected}
					onChange={(event) => onSelectedChange(message.id, event.target.checked)}
					className="h-4 w-4 rounded border-neutral-300"
					aria-label="Select message"
				/>
				<button type="button" className="contents text-left" onClick={() => openDraftComposer(message.id)}>
					{content}
				</button>
			</div>
		);
	}

	return (
		<div
			className={className}
			draggable={draggable}
			onDragStart={(event) => {
				if (!draggable) return;
				setMessageDragData(event.dataTransfer, { messageIds: dragMessageIds });
			}}
		>
			<MessageNavigationProgress progress={navigation.progress} />
			<Checkbox
				checked={selected}
				onChange={(event) => onSelectedChange(message.id, event.target.checked, group?.messageIds)}
				className={`h-4 w-4 rounded border-neutral-300 ${prefs.senderAvatars ? "max-md:hidden" : ""}`}
				aria-label={group ? "Select all emails from this sender" : "Select message"}
			/>
			<Link href={href} onClick={onMessageNavigate} className="contents">
				{content}
			</Link>
			{(config.folder === "inbox" || config.folder === "snoozed") && message.direction === "inbound" && (
				<MessageListRowActions
					message={rowMessage}
					group={group}
					onAction={async (action) => {
						const previousRead = read;
						const unreadDelta = action === "read" ? -1 : action === "unread" ? 1 : 0;
						if (action === "read") setRead(true);
						if (action === "unread") setRead(false);
						if (unreadDelta) dispatchMessageCountsDelta({ inboxUnreadDelta: unreadDelta });
						try {
							await onMessageAction(message.id, action);
							if (action === "archive" || action === "trash") {
								emitUndo(action === "archive" ? "Message archived" : "Message moved to Trash", () =>
									moveMessagesToInbox([message.id]),
								);
							}
						} catch (error) {
							if (action === "read" || action === "unread") {
								setRead(previousRead);
								if (unreadDelta) dispatchMessageCountsDelta({ inboxUnreadDelta: -unreadDelta });
							}
							throw error;
						}
					}}
				/>
			)}
		</div>
	);
}

export function MessageFolderPage({
	config,
	compact = false,
	selectedMessageId,
	selection,
}: MessageFolderPageProps) {
	const { selectedMailbox, isLoading: mailboxesLoading } = useSelectedMailbox();
	const { query } = useMailSearch();
	const [offset, setOffset] = useState(0);
	const [internalSelectedMessages, setInternalSelectedMessages] = useState<
		Array<{ id: string; read: boolean }>
	>([]);
	const [pendingBulkAction, setPendingBulkAction] = useState(false);
	const [emptyingTrash, setEmptyingTrash] = useState(false);

	// In Trash, "delete" means permanent removal — map the trash action accordingly.
	const resolveAction = (action: BulkMessageAction): BulkMessageAction =>
		config.folder === "trash" && action === "trash" ? "delete" : action;

	async function emptyTrash() {
		if (!window.confirm("Permanently delete all messages in Trash? This cannot be undone.")) return;
		setEmptyingTrash(true);
		try {
			const res = await authFetch("/api/messages/empty-trash", { method: "POST" });
			if (res.ok) window.dispatchEvent(new Event("trtmail:messages-changed"));
		} finally {
			setEmptyingTrash(false);
		}
	}

	const [unreadOnly, setUnreadOnly] = useState(false);
	const [attachmentsOnly, setAttachmentsOnly] = useState(false);
	const [starredOnly, setStarredOnly] = useState(false);
	const effectiveQuery = [query, attachmentsOnly ? "has:attachment" : "", starredOnly ? "is:starred" : ""]
		.filter(Boolean)
		.join(" ");
	const { prefs, setPref } = useDisplayPrefs();
	const groupBySender = prefs.groupBySender;
	const [expandedSenders, setExpandedSenders] = useState<Set<string>>(new Set());
	function toggleGroupBySender() {
		setPref("groupBySender", !groupBySender);
	}
	function toggleSender(key: string) {
		setExpandedSenders((current) => {
			const next = new Set(current);
			if (!next.delete(key)) next.add(key);
			return next;
		});
	}
	const { messages, isLoading, total, limit, updateMessages } = useMessages(config.folder, selectedMailbox?.id, {
		query: effectiveQuery,
		limit: pageSize,
		offset,
		read: unreadOnly ? "unread" : "all",
	}, !mailboxesLoading, config.folderId);
	const canGroup = groupBySender && config.folder !== "drafts";
	const senderGroups = useMemo(
		() => (canGroup ? groupMessagesBySender(messages, config.folder) : []),
		[canGroup, messages, config.folder],
	);
	const { counts } = useMessageCounts(selectedMailbox?.id, !mailboxesLoading);
	usePageLoading(mailboxesLoading || isLoading);
	const headerIcons = config.headerIcons ?? [];
	const hasActiveFilters = !!effectiveQuery.trim() || unreadOnly;
	const folderCount = config.folderId
		? counts.customFolders[config.folderId]
		: counts.folders[config.folder];
	const titleTotal = folderCount?.total ?? total;
	const titleUnread = folderCount?.unread ?? 0;
	const mailboxAddress = getMailboxAddress(selectedMailbox);
	const currentAccountName = selectedMailbox?.displayName ?? selectedMailbox?.localPart;
	const pageRange = getPageRange(offset, messages.length, total);
	const selectedMessages = selection?.selectedMessages ?? internalSelectedMessages;
	const setSelectedMessages =
		selection?.setSelectedMessages ?? setInternalSelectedMessages;
	const selectedIds = useMemo(
		() => selectedMessages.map((message) => message.id),
		[selectedMessages],
	);
	const hasUnreadSelection = selectedMessages.some((message) => !message.read);
	const allVisibleSelected = messages.length > 0 && messages.every((message) => selectedIds.includes(message.id));

	useEffect(() => {
		setOffset(0);
		setSelectedMessages([]);
	}, [query, selectedMailbox?.id, config.folder, config.folderId, unreadOnly, attachmentsOnly, starredOnly]);

	useEffect(() => {
		setSelectedMessages([]);
	}, [offset]);

	useEffect(() => {
		if (mailboxesLoading) return;
		document.title = formatEmailPageTitle({
			location: config.title,
			total: titleTotal,
			unread: titleUnread,
			emailAddress: mailboxAddress,
		});
	}, [config.title, mailboxAddress, mailboxesLoading, titleTotal, titleUnread]);

	function updateSelectedMessage(messageId: string, selected: boolean, groupIds?: string[]) {
		const ids = new Set(groupIds?.length ? groupIds : [messageId]);
		const targets = messages.filter((item) => ids.has(item.id));
		if (targets.length === 0) return;

		setSelectedMessages((current) => {
			if (!selected) return current.filter((item) => !ids.has(item.id));
			const next = new Map(current.map((item) => [item.id, item]));
			for (const message of targets) next.set(message.id, { id: message.id, read: message.read });
			return Array.from(next.values());
		});
	}

	function toggleAllVisible(selected: boolean) {
		const visibleIds = new Set(messages.map((message) => message.id));
		setSelectedMessages((current) => {
			if (!selected) {
				return current.filter((message) => !visibleIds.has(message.id));
			}

			const next = new Map(current.map((message) => [message.id, message]));
			for (const message of messages) {
				next.set(message.id, { id: message.id, read: message.read });
			}
			return Array.from(next.values());
		});
	}

	async function runSelectedAction(action: BulkMessageAction) {
		if (selectedIds.length === 0) return;

		setPendingBulkAction(true);
		const previousMessages = messages;
		const readValue = action === "read" ? true : action === "unread" ? false : null;
		const changedMessages = readValue === null
			? []
			: messages.filter((message) => selectedIds.includes(message.id) && message.read !== readValue);
		if (readValue !== null) {
			updateMessages((current) => current.map((message) =>
				selectedIds.includes(message.id) ? { ...message, read: readValue } : message,
			));
			setSelectedMessages((current) => current.map((message) => ({ ...message, read: readValue })));
			const inboxUnreadDelta = changedMessages
				.filter((message) => message.direction === "inbound")
				.reduce((total, message) => total + (readValue ? (message.read ? 0 : -1) : (message.read ? 1 : 0)), 0);
			if (inboxUnreadDelta) dispatchMessageCountsDelta({ inboxUnreadDelta });
		}
		try {
			await runBulkMessageAction(selectedIds, resolveAction(action));
			setSelectedMessages([]);
		} catch (error) {
			if (readValue !== null) {
				updateMessages(previousMessages);
				const inboxUnreadDelta = changedMessages
					.filter((message) => message.direction === "inbound")
					.reduce((total, message) => total + (readValue ? (message.read ? 0 : 1) : (message.read ? -1 : 0)), 0);
				if (inboxUnreadDelta) dispatchMessageCountsDelta({ inboxUnreadDelta });
			}
			throw error;
		} finally {
			setPendingBulkAction(false);
		}
	}

	async function runSelectedFolderMove(folderId: string) {
		if (selectedIds.length === 0) return;
		setPendingBulkAction(true);
		try {
			await runBulkMessageAction(selectedIds, "folder", true, folderId);
			setSelectedMessages([]);
		} finally {
			setPendingBulkAction(false);
		}
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className={`flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 ${compact ? "px-4" : "px-3 md:px-6"}`}>
				<div className="flex items-center gap-3 w-full">
					<Tooltip label="Select all visible messages">
						<Checkbox
							checked={allVisibleSelected}
							disabled={messages.length === 0}
							onChange={(event) => toggleAllVisible(event.target.checked)}
							className="h-4 w-4 rounded border-neutral-300"
							aria-label="Select all visible messages"
						/>
					</Tooltip>
					{selectedIds.length > 0 && !compact ? (
						<BulkMessageToolbar
							selectedCount={selectedIds.length}
							hasUnreadSelection={hasUnreadSelection}
							onAction={runSelectedAction}
							onMoveToFolder={runSelectedFolderMove}
							onClearSelection={() => setSelectedMessages([])}
							pending={pendingBulkAction}
						/>
					) : config.folder === "trash" && !compact && messages.length > 0 ? (
						<div className="flex w-full items-center justify-end">
							<Button
								variant="ghost"
								size="sm"
								onClick={emptyTrash}
								disabled={emptyingTrash}
								className="text-red-600 hover:bg-red-50 hover:text-red-700"
							>
								<Trash2 className="mr-1.5 h-4 w-4" />
								{emptyingTrash ? "Emptying…" : "Empty trash"}
							</Button>
						</div>
					) : (
						compact && (
							<>
								{/* <h1 className="truncate text-sm font-semibold text-neutral-900">
									{config.title}
								</h1>
								<Badge variant="secondary">{total}</Badge> */}
							</>
						)
					)}
				</div>
				{(selectedIds.length === 0 || compact) && (
					<div className="flex items-center gap-2 text-neutral-500">
						<span className="hidden text-xs text-neutral-500 whitespace-nowrap sm:inline">
							{pageRange.start} - {pageRange.end} of {pageRange.total}
						</span>
						<Tooltip label="Previous page">
							<Button
								variant="ghost"
								size="sm"
								disabled={offset === 0 || isLoading}
								onClick={() => setOffset(Math.max(offset - limit, 0))}
								aria-label="Previous page"
							>
								<ChevronLeft className="h-4 w-4" />
							</Button>
						</Tooltip>
						<Tooltip label="Next page">
							<Button
								variant="ghost"
								size="sm"
								disabled={offset + messages.length >= total || isLoading}
								onClick={() => setOffset(offset + limit)}
								aria-label="Next page"
							>
								<ChevronRight className="h-4 w-4" />
							</Button>
						</Tooltip>
						{config.folder !== "drafts" && (
							<Tooltip label={groupBySender ? "Grouped by sender (click to ungroup)" : "Group emails by sender"}>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									aria-label="Group emails by sender"
									aria-pressed={groupBySender}
									onClick={toggleGroupBySender}
									className={groupBySender ? "bg-blue-100 text-blue-700 hover:bg-blue-100" : undefined}
								>
									<Layers className="h-4 w-4" />
								</Button>
							</Tooltip>
						)}
						{config.folder === "inbox" && (
							<Tooltip label={unreadOnly ? "Showing unread emails" : "Show unread emails only"}>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									aria-label="Show unread emails only"
									aria-pressed={unreadOnly}
									onClick={() => setUnreadOnly((current) => !current)}
									className={unreadOnly ? "bg-blue-100 text-blue-700 hover:bg-blue-100" : undefined}
								>
									<ListFilter className="h-4 w-4" />
								</Button>
							</Tooltip>
						)}
						{config.folder !== "drafts" && (
							<Tooltip label={attachmentsOnly ? "Showing emails with attachments" : "Show emails with attachments only"}>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									aria-label="Show emails with attachments only"
									aria-pressed={attachmentsOnly}
									onClick={() => setAttachmentsOnly((current) => !current)}
									className={attachmentsOnly ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-100" : undefined}
								>
									<Paperclip className="h-4 w-4" />
								</Button>
							</Tooltip>
						)}
						{config.folder !== "drafts" && config.folder !== "starred" && (
							<Tooltip label={starredOnly ? "Showing starred emails" : "Show starred emails only"}>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									aria-label="Show starred emails only"
									aria-pressed={starredOnly}
									onClick={() => setStarredOnly((current) => !current)}
									className={starredOnly ? "bg-amber-100 text-amber-700 hover:bg-amber-100" : undefined}
								>
									<Star className={`h-4 w-4 ${starredOnly ? "fill-amber-400" : ""}`} />
								</Button>
							</Tooltip>
						)}
						{!compact && headerIcons.map((Icon, index) => (
							<Icon key={index} className="h-4 w-4" />
						))}
					</div>
				)}
			</div>

			<div className="min-h-0 flex-1 divide-y divide-slate-200/70 overflow-y-auto overscroll-contain scrollbar-gutter-stable">
				{(canGroup
					? senderGroups.flatMap((group) => {
							const [latest, ...older] = group.messages;
							const hasUnread = group.messages.some((m) => m.direction === "inbound" && !m.read);
							const toggled = expandedSenders.has(group.key);
							const expanded = prefs.autoExpandUnread && hasUnread ? !toggled : toggled;
							const ids = group.messages.map((m) => m.id);
							const info: MessageGroupInfo | undefined = older.length
								? {
										count: group.messages.length,
										unreadCount: group.messages.filter((m) => m.direction === "inbound" && !m.read).length,
										hasAttachments: group.messages.some((m) => m.hasAttachments),
										expanded,
										onToggle: () => toggleSender(group.key),
										messageIds: ids,
										onAction: (action) => {
											void runBulkMessageAction(ids, action, true).then(() => {
												if (action === "archive") emitUndo(`${ids.length} emails archived`, () => moveMessagesToInbox(ids));
											});
										},
									}
								: undefined;
							return [
								{ message: latest, group: info, nested: false },
								...(info?.expanded ? older.map((message) => ({ message, group: undefined, nested: true })) : []),
							];
						})
					: messages.map((message) => ({ message, group: undefined, nested: false }))
				).map(({ message, group, nested }) => (
					<MessageListRow
						key={message.id}
						message={message}
						config={config}
						selected={selectedIds.includes(message.id)}
						active={message.id === selectedMessageId}
						compact={compact}
						currentAccountName={currentAccountName}
						onSelectedChange={updateSelectedMessage}
						onMessageAction={(messageId, action) => runBulkMessageAction([messageId], resolveAction(action), action !== "read" && action !== "unread")}
						dragMessageIds={selectedIds.includes(message.id) ? selectedIds : [message.id]}
						group={group}
						nested={nested}
						prefs={prefs}
					/>
				))}
				{!isLoading && messages.length === 0 && (
					<section className="flex min-h-[45vh] flex-col items-center justify-center px-6 py-12 text-center"><div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-500"><Inbox size={28} strokeWidth={1.5}/></div><h2 className="text-lg font-semibold text-slate-800">{hasActiveFilters ? "No messages match these filters" : config.emptyText}</h2><p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">{hasActiveFilters ? "Try another search or adjust your filters." : "Messages in this folder will appear here. Start a conversation with your team or a client."}</p></section>
				)}
			</div>
		</div>
	);
}

export type MessageStatus = "received" | "sent" | "draft" | "queued" | "failed" | "archived" | "trash" | "spam";

export type MessageFolder = "inbox" | "starred" | "snoozed" | "sent" | "drafts" | "archived" | "trash" | "spam";

export type MessageDirection = "inbound" | "outbound";

export type Message = {
	id: string;
	userId: string;
	mailboxId: string | null;
	folderId: string | null;
	direction: MessageDirection;
	providerMessageId: string | null;
	fromAddr: string;
	toAddr: string;
	ccAddr?: string | null;
	bccAddr?: string | null;
	fromContactName?: string | null;
	toContactName?: string | null;
	subject: string | null;
	snippet: string | null;
	textBody?: string | null;
	htmlBody?: string | null;
	status: MessageStatus | string;
	read: boolean;
	starred: boolean;
	pinned?: boolean;
	replied?: boolean;
	hasAttachments?: boolean;
	snoozedUntil?: string | null;
	// Outbound tracking summary (see /api/messages/[id]/tracking for the timeline)
	deliveryStatus?: "queued" | "sent" | "delivered" | "bounced" | "failed" | null;
	deliveryDetail?: string | null;
	sentAt?: string | null;
	deliveredAt?: string | null;
	bouncedAt?: string | null;
	openCount?: number;
	firstOpenedAt?: string | null;
	lastOpenedAt?: string | null;
	clickCount?: number;
	firstClickedAt?: string | null;
	lastClickedAt?: string | null;
	threadId: string | null;
	createdAt: string;
};

export type MessageReadFilter = "all" | "read" | "unread";

export type MessageFilterOptions = {
	query?: string;
	read?: MessageReadFilter;
	title?: string;
	limit?: number;
	offset?: number;
	/** Page by sender groups instead of single emails. */
	group?: "sender";
};

export type MessageListResponse = {
	messages?: Message[];
	total?: number;
	limit?: number;
	offset?: number;
};

export type FolderCount = {
	total: number;
	unread: number;
};

export type MailboxCount = {
	mailboxId: string;
	total: number;
	unread: number;
	inbox: number;
};

export type MessageCounts = {
	folders: Record<MessageFolder, FolderCount>;
	customFolders: Record<string, FolderCount>;
	mailboxes: MailboxCount[];
};

export type MessageCountsDelta = {
	inboxUnreadDelta?: number;
};

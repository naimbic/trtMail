export type ComposeDraft = {
	id: string;
	mailboxId: string | null;
	fromAddr: string;
	toAddr: string;
	ccAddr: string | null;
	bccAddr: string | null;
	subject: string | null;
	textBody: string | null;
	htmlBody: string | null;
};

export type DraftResponse = {
	draft?: ComposeDraft;
	error?: string;
};

export type ComposeAttachment = {
	id: string;
	file: File;
};

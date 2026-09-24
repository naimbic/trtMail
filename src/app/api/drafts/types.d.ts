export type DraftPayload = {
	mailboxId?: string | null;
	from?: string;
	to?: string;
	cc?: string;
	bcc?: string;
	subject?: string;
	text?: string;
	html?: string;
};

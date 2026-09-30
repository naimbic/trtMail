"use client";

import { useEffect, useState } from "react";
import { Code, PenLine } from "lucide-react";
import { useSelectedMailbox } from "@/components/mailbox-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichEditor } from "@/components/compose/rich-editor";
import { updateMailboxSignature } from "./utils";

export function MailboxSignatureForm() {
	const { selectedMailbox, setSelectedMailbox, isLoading } = useSelectedMailbox();
	const [signature, setSignature] = useState("");
	const [savedSignature, setSavedSignature] = useState("");
	const [status, setStatus] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	// Toggle between the WYSIWYG editor and raw-HTML source (for pasting a full
	// HTML signature). `editorNonce` re-mounts the editor so it re-seeds from the
	// current signature when switching back or changing mailbox.
	const [htmlMode, setHtmlMode] = useState(false);
	const [editorNonce, setEditorNonce] = useState(0);

	useEffect(() => {
		const nextSignature = selectedMailbox?.signature ?? "";
		setSignature(nextSignature);
		setSavedSignature(nextSignature);
		setStatus(null);
		setEditorNonce((n) => n + 1);
	}, [selectedMailbox?.id, selectedMailbox?.signature]);

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!selectedMailbox) return;
		setSaving(true);
		setStatus(null);
		try {
			const saved = await updateMailboxSignature(selectedMailbox.id, signature);
			setSignature(saved);
			setSavedSignature(saved);
			setEditorNonce((n) => n + 1);
			setSelectedMailbox({ ...selectedMailbox, signature: saved });
			setStatus("Saved");
		} catch (error) {
			setStatus(error instanceof Error ? error.message : "Failed to update signature");
		} finally {
			setSaving(false);
		}
	}

	if (isLoading) return <p className="text-sm text-neutral-500">Loading inbox…</p>;
	if (!selectedMailbox) return <p className="text-sm text-neutral-500">Select an inbox to configure its signature.</p>;

	const address = `${selectedMailbox.localPart}@${selectedMailbox.hostname}`;
	const canManage = selectedMailbox.permission === "full_access";

	return (
		<form onSubmit={onSubmit} className="space-y-4">
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label htmlFor="mailboxSignature">Signature for {address}</Label>
					<button
						type="button"
						onClick={() => {
							if (htmlMode) setEditorNonce((n) => n + 1); // returning to editor → re-seed from HTML
							setHtmlMode((m) => !m);
						}}
						className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
					>
						{htmlMode ? <PenLine className="h-3.5 w-3.5" /> : <Code className="h-3.5 w-3.5" />}
						{htmlMode ? "Editor" : "HTML"}
					</button>
				</div>
				{htmlMode ? (
					<Textarea
						id="mailboxSignature"
						value={signature}
						onChange={(e) => setSignature(e.target.value)}
						disabled={!canManage || saving}
						rows={10}
						spellCheck={false}
						placeholder="<table>…</table>"
						className="font-mono text-xs"
					/>
				) : (
					<div className="min-h-[180px] rounded-lg border border-neutral-200 px-3 py-2">
						<RichEditor
							key={editorNonce}
							seed={signature}
							disabled={!canManage || saving}
							onChange={(nextHtml) => setSignature(nextHtml)}
							placeholder={"Your name\nRole or company\nContact details"}
							className="min-h-[130px]"
						/>
					</div>
				)}
				<p className="text-xs leading-5 text-neutral-500">
					Use the editor for quick formatting, or switch to <strong>HTML</strong> to paste a full HTML signature.
					Added automatically when you write from this inbox.
				</p>
			</div>
			<div className="flex items-center gap-3">
				<Button type="submit" disabled={!canManage || saving || signature.trim() === savedSignature}>
					{saving ? "Saving..." : "Save signature"}
				</Button>
				{!canManage && <p className="text-sm text-neutral-500">Full access is required to edit this signature.</p>}
				{status && <p className="text-sm text-neutral-500">{status}</p>}
			</div>
		</form>
	);
}

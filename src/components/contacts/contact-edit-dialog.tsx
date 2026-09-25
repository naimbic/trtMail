"use client";

import { useRef, useState } from "react";
import { Upload, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/auth/client";
import type { DirectoryContact } from "./directory-types";

export function ContactEditDialog({
	contact,
	open,
	onOpenChange,
	onSaved,
}: {
	contact?: DirectoryContact | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSaved: () => void;
}) {
	const isEdit = Boolean(contact?.id);
	const [displayName, setDisplayName] = useState(contact?.displayName ?? "");
	const [email, setEmail] = useState(contact?.email ?? "");
	const [company, setCompany] = useState(contact?.company ?? "");
	const [phone, setPhone] = useState(contact?.phone ?? "");
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [avatarPreview, setAvatarPreview] = useState<string | null>(
		contact?.avatarKey ? `/api/contacts/${contact.id}/avatar` : null,
	);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fileInput = useRef<HTMLInputElement | null>(null);

	function pickAvatar(file: File | null) {
		if (!file) return;
		if (file.size > 2 * 1024 * 1024) {
			setError("Image must be 2 MB or smaller");
			return;
		}
		setAvatarFile(file);
		setAvatarPreview(URL.createObjectURL(file));
	}

	async function save() {
		setSaving(true);
		setError(null);
		try {
			let contactId = contact?.id;
			if (isEdit && contactId) {
				const res = await authFetch(`/api/contacts/${contactId}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ displayName, company, phone }),
				});
				if (!res.ok) throw new Error("Could not update contact");
			} else {
				if (!email.trim()) throw new Error("Email is required");
				const res = await authFetch(`/api/contacts/directory`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ email, displayName, company, phone }),
				});
				const data = (await res.json()) as { contact?: { id: string }; error?: string };
				if (!res.ok || !data.contact) throw new Error(data.error ?? "Could not create contact");
				contactId = data.contact.id;
			}
			if (avatarFile && contactId) {
				const form = new FormData();
				form.append("file", avatarFile);
				await authFetch(`/api/contacts/${contactId}/avatar`, { method: "POST", body: form });
			}
			onSaved();
			onOpenChange(false);
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : "Could not save contact");
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{isEdit ? "Edit contact" : "New contact"}</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<div className="flex items-center gap-4">
						<div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-neutral-400">
							{avatarPreview ? (
								// eslint-disable-next-line @next/next/no-img-element
								<img src={avatarPreview} alt="" className="h-full w-full object-cover" />
							) : (
								<User className="h-7 w-7" />
							)}
						</div>
						<div>
							<input
								ref={fileInput}
								type="file"
								accept="image/png,image/jpeg,image/webp,image/gif"
								className="hidden"
								onChange={(e) => pickAvatar(e.target.files?.[0] ?? null)}
							/>
							<Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
								<Upload className="mr-2 h-4 w-4" /> {avatarPreview ? "Change photo" : "Upload photo"}
							</Button>
							<p className="mt-1 text-xs text-neutral-400">PNG, JPG, WEBP or GIF · up to 2 MB</p>
						</div>
					</div>
					<div className="space-y-2">
						<Label htmlFor="c-name">Full name</Label>
						<Input id="c-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Maya Chen" />
					</div>
					<div className="space-y-2">
						<Label htmlFor="c-email">Email</Label>
						<Input
							id="c-email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="maya@example.com"
							disabled={isEdit}
						/>
						{isEdit && <p className="text-xs text-neutral-400">Email can't be changed; delete and re-add to change it.</p>}
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-2">
							<Label htmlFor="c-company">Company</Label>
							<Input id="c-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc." />
						</div>
						<div className="space-y-2">
							<Label htmlFor="c-phone">Phone</Label>
							<Input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+212 …" />
						</div>
					</div>
					{error && <p className="text-sm text-red-600">{error}</p>}
					<div className="flex justify-end gap-2">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
							Cancel
						</Button>
						<Button type="button" onClick={() => void save()} disabled={saving}>
							{saving ? "Saving…" : "Save contact"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

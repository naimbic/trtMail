"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, Pencil, Plus, Search, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useCompose } from "@/components/compose/compose-context";
import { ContactEditDialog } from "@/components/contacts/contact-edit-dialog";
import type { DirectoryContact } from "@/components/contacts/directory-types";
import { authFetch } from "@/lib/auth/client";

export default function ContactsPage() {
	const { openComposerWith } = useCompose();
	const [contacts, setContacts] = useState<DirectoryContact[]>([]);
	const [loading, setLoading] = useState(true);
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [editing, setEditing] = useState<DirectoryContact | null | undefined>(undefined);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await authFetch("/api/contacts/directory");
			const data = (await res.json()) as { contacts?: DirectoryContact[] };
			setContacts(data.contacts ?? []);
		} catch {
			setContacts([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const filtered = useMemo(() => {
		const term = query.trim().toLowerCase();
		const rows = term
			? contacts.filter((c) =>
					[c.displayName, c.email, c.company].some((v) => v?.toLowerCase().includes(term)),
				)
			: contacts;
		return [...rows].sort((a, b) =>
			(a.displayName ?? a.email).localeCompare(b.displayName ?? b.email),
		);
	}, [contacts, query]);

	const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

	function toggle(id: string, checked: boolean) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (checked) next.add(id);
			else next.delete(id);
			return next;
		});
	}

	function toggleAll(checked: boolean) {
		setSelected(checked ? new Set(filtered.map((c) => c.id)) : new Set());
	}

	function composeSelected() {
		const emails = filtered.filter((c) => selected.has(c.id)).map((c) => c.email);
		if (emails.length) openComposerWith(emails.join(", "));
	}

	async function deleteSelected() {
		const ids = [...selected];
		if (ids.length === 0) return;
		if (!window.confirm(`Delete ${ids.length} contact${ids.length > 1 ? "s" : ""}?`)) return;
		await authFetch("/api/contacts/directory", {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ids }),
		});
		setSelected(new Set());
		void load();
	}

	return (
		<div className="flex h-full flex-col">
			<div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 px-6 py-3">
				<h1 className="text-lg font-semibold text-neutral-900">Contacts</h1>
				<span className="text-sm text-neutral-400">{contacts.length}</span>
				<div className="relative ml-auto w-64 max-w-full">
					<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
					<Input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search contacts"
						className="pl-9"
					/>
				</div>
				<Button type="button" onClick={() => setEditing(null)}>
					<Plus className="mr-2 h-4 w-4" /> New contact
				</Button>
			</div>

			{selected.size > 0 && (
				<div className="flex items-center gap-3 border-b border-neutral-200 bg-blue-50/60 px-6 py-2 text-sm">
					<span className="font-medium text-neutral-700">{selected.size} selected</span>
					<Button type="button" variant="outline" size="sm" onClick={composeSelected}>
						<Mail className="mr-2 h-4 w-4" /> Compose
					</Button>
					<Button type="button" variant="outline" size="sm" onClick={() => void deleteSelected()}>
						<Trash2 className="mr-2 h-4 w-4" /> Delete
					</Button>
				</div>
			)}

			<div className="min-h-0 flex-1 overflow-y-auto">
				{loading ? (
					<p className="px-6 py-6 text-sm text-neutral-500">Loading…</p>
				) : filtered.length === 0 ? (
					<p className="px-6 py-6 text-sm text-neutral-500">
						{query ? "No contacts match your search." : "No contacts yet. Add one to get started."}
					</p>
				) : (
					<table className="w-full text-sm">
						<thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wide text-neutral-400">
							<tr className="border-b border-neutral-100">
								<th className="w-10 px-6 py-2">
									<Checkbox
										checked={allSelected}
										onChange={(e) => toggleAll(e.target.checked)}
										className="h-4 w-4 rounded border-neutral-300"
										aria-label="Select all"
									/>
								</th>
								<th className="px-2 py-2 font-medium">Name</th>
								<th className="px-2 py-2 font-medium">Company</th>
								<th className="px-2 py-2 font-medium">Phone</th>
								<th className="w-10 px-6 py-2" />
							</tr>
						</thead>
						<tbody>
							{filtered.map((contact) => (
								<tr key={contact.id} className="group border-b border-neutral-50 hover:bg-neutral-50">
									<td className="px-6 py-2">
										<Checkbox
											checked={selected.has(contact.id)}
											onChange={(e) => toggle(contact.id, e.target.checked)}
											className="h-4 w-4 rounded border-neutral-300"
											aria-label={`Select ${contact.email}`}
										/>
									</td>
									<td className="px-2 py-2">
										<button type="button" className="flex items-center gap-3 text-left" onClick={() => setEditing(contact)}>
											<span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-neutral-400">
												{contact.avatarKey ? (
													// eslint-disable-next-line @next/next/no-img-element
													<img src={`/api/contacts/${contact.id}/avatar`} alt="" className="h-full w-full object-cover" />
												) : (
													<User className="h-4 w-4" />
												)}
											</span>
											<span className="min-w-0">
												<span className="block truncate font-medium text-neutral-900">{contact.displayName ?? contact.email}</span>
												<span className="block truncate text-xs text-neutral-500">{contact.email}</span>
											</span>
										</button>
									</td>
									<td className="px-2 py-2 text-neutral-600">{contact.company ?? "—"}</td>
									<td className="px-2 py-2 text-neutral-600">{contact.phone ?? "—"}</td>
									<td className="px-6 py-2">
										<div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
											<Button type="button" variant="ghost" size="sm" aria-label="Email" onClick={() => openComposerWith(contact.email)}>
												<Mail className="h-4 w-4" />
											</Button>
											<Button type="button" variant="ghost" size="sm" aria-label="Edit" onClick={() => setEditing(contact)}>
												<Pencil className="h-4 w-4" />
											</Button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>

			{editing !== undefined && (
				<ContactEditDialog
					contact={editing}
					open={editing !== undefined}
					onOpenChange={(open) => {
						if (!open) setEditing(undefined);
					}}
					onSaved={() => void load()}
				/>
			)}
		</div>
	);
}

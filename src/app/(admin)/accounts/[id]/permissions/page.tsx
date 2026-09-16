"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { AccountMailboxAccessItem, ManagedAccount } from "../types";
import {
	fetchManagedAccount,
	saveManagedAccount,
	fetchAccountMailboxAccess,
	grantAccountMailboxAccess,
	revokeAccountMailboxAccess,
	getMailboxAddress,
	permissionLabels,
} from "../utils";

const PERMISSION_OPTIONS: NonNullable<AccountMailboxAccessItem["permission"]>[] = [
	"read_only",
	"send_as",
	"send_on_behalf",
	"full_access",
];

export default function AccountPermissionsPage() {
	const { id } = useParams<{ id: string }>();
	const [account, setAccount] = useState<ManagedAccount | null>(null);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [mailboxes, setMailboxes] = useState<AccountMailboxAccessItem[]>([]);
	const [mailboxMsg, setMailboxMsg] = useState<string | null>(null);
	const [busyMailbox, setBusyMailbox] = useState<string | null>(null);

	useEffect(() => {
		void fetchManagedAccount(id)
			.then(setAccount)
			.catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load permissions"));
		void fetchAccountMailboxAccess(id)
			.then((res) => setMailboxes(res.mailboxes))
			.catch((error) => setMailboxMsg(error instanceof Error ? error.message : "Unable to load mailbox access"));
	}, [id]);

	async function setMailboxPermission(mailboxId: string, permission: AccountMailboxAccessItem["permission"] | "") {
		setBusyMailbox(mailboxId);
		setMailboxMsg(null);
		try {
			if (!permission) {
				await revokeAccountMailboxAccess(id, mailboxId);
			} else {
				await grantAccountMailboxAccess(id, mailboxId, permission);
			}
			setMailboxes((current) =>
				current.map((m) => (m.mailboxId === mailboxId ? { ...m, permission: permission || undefined } : m)),
			);
			setMailboxMsg("Access updated");
		} catch (error) {
			setMailboxMsg(error instanceof Error ? error.message : "Unable to update access");
		} finally {
			setBusyMailbox(null);
		}
	}

	async function savePermissions() {
		if (!account) return;
		setSaving(true);
		setMessage(null);
		try {
			await saveManagedAccount(account);
			setMessage("Permissions updated");
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Unable to update permissions");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-medium text-neutral-900">Permissions</h1>
				<p className="mt-2 text-sm text-neutral-500">Control what this account can manage.</p>
			</div>
			<div className="overflow-hidden rounded-3xl bg-white">
				<table className="w-full text-left">
					<thead className="border-b border-neutral-100 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
						<tr>
							<th className="px-5 py-3">Permission</th>
							<th className="w-28 px-5 py-3 text-center">Allowed</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-neutral-100">
						<tr>
							<td className="px-5 py-4">
								<p className="text-sm font-semibold text-neutral-900">Administrator access</p>
								<p className="mt-1 text-xs text-neutral-500">Access administration pages and manage Team settings.</p>
							</td>
							<td className="px-5 py-4 text-center">
								<Checkbox
									aria-label="Allow administrator access"
									checked={account?.role === "admin"}
									disabled={!account}
									onChange={(event) => account && setAccount({ ...account, role: event.target.checked ? "admin" : "user" })}
								/>
							</td>
						</tr>
						<tr>
							<td className="px-5 py-4">
								<p className="text-sm font-semibold text-neutral-900">Manage mailboxes</p>
								<p className="mt-1 text-xs text-neutral-500">Allow this account to add and remove its own inboxes.</p>
							</td>
							<td className="px-5 py-4 text-center">
								<Checkbox
									aria-label="Allow mailbox management"
									checked={account?.canManageMailboxes ?? false}
									disabled={!account}
									onChange={(event) => account && setAccount({ ...account, canManageMailboxes: event.target.checked })}
								/>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
			<Button onClick={() => void savePermissions()} disabled={!account || saving}>
				{saving ? "Saving..." : "Save permissions"}
			</Button>
			{message && <p className="text-sm text-neutral-500">{message}</p>}

			<div className="pt-4">
				<h2 className="text-xl font-medium text-neutral-900">Shared mailbox access</h2>
				<p className="mt-1 text-sm text-neutral-500">
					Give this user access to shared mailboxes (e.g. support@, contact@). Changes save immediately.
				</p>
				<div className="mt-4 overflow-hidden rounded-3xl bg-white">
					<table className="w-full text-left">
						<thead className="border-b border-neutral-100 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
							<tr>
								<th className="px-5 py-3">Mailbox</th>
								<th className="w-56 px-5 py-3">Access</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-neutral-100">
							{mailboxes.length === 0 ? (
								<tr>
									<td colSpan={2} className="px-5 py-6 text-sm text-neutral-500">
										No shared mailboxes yet. Create a mailbox with type “Shared” first, then assign it here.
									</td>
								</tr>
							) : (
								mailboxes.map((mailbox) => (
									<tr key={mailbox.mailboxId}>
										<td className="px-5 py-4 text-sm font-medium text-neutral-900">{getMailboxAddress(mailbox)}</td>
										<td className="px-5 py-4">
											<select
												className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-sm"
												disabled={busyMailbox === mailbox.mailboxId}
												value={mailbox.permission ?? ""}
												onChange={(event) =>
													void setMailboxPermission(
														mailbox.mailboxId,
														event.target.value as AccountMailboxAccessItem["permission"] | "",
													)
												}
											>
												<option value="">No access</option>
												{PERMISSION_OPTIONS.map((permission) => (
													<option key={permission} value={permission}>
														{permissionLabels[permission]}
													</option>
												))}
											</select>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
				{mailboxMsg && <p className="mt-3 text-sm text-neutral-500">{mailboxMsg}</p>}
			</div>
		</div>
	);
}

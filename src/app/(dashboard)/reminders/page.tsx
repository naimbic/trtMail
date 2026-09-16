"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Check, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/auth/client";

type Reminder = {
	id: string;
	type: "reply" | "call" | "contact" | "follow_up" | "task";
	title: string;
	notes: string;
	dueAt: string | number;
	status: "open" | "done" | "snoozed" | "cancelled";
	messageId: string | null;
};

const TYPE_LABEL: Record<Reminder["type"], string> = {
	reply: "Reply",
	call: "Call",
	contact: "Contact",
	follow_up: "Follow-up",
	task: "Task",
};

function startOfTomorrow(): Date {
	const d = new Date();
	d.setHours(9, 0, 0, 0);
	d.setDate(d.getDate() + 1);
	return d;
}

export default function RemindersPage() {
	const [items, setItems] = useState<Reminder[]>([]);
	const [loading, setLoading] = useState(true);
	const [title, setTitle] = useState("");
	const [type, setType] = useState<Reminder["type"]>("task");
	const [dueAt, setDueAt] = useState(() => {
		const d = startOfTomorrow();
		const off = d.getTimezoneOffset();
		return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
	});
	const [saving, setSaving] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await authFetch("/api/reminders?filter=open");
			const data = (await res.json()) as { reminders?: Reminder[] };
			setItems(data.reminders ?? []);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	async function create() {
		if (!title.trim()) return;
		setSaving(true);
		try {
			await authFetch("/api/reminders", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: title.trim(), type, dueAt: new Date(dueAt).toISOString() }),
			});
			setTitle("");
			await load();
		} finally {
			setSaving(false);
		}
	}

	async function patch(id: string, body: Record<string, unknown>) {
		await authFetch(`/api/reminders/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		await load();
	}

	async function remove(id: string) {
		await authFetch(`/api/reminders/${id}`, { method: "DELETE" });
		await load();
	}

	const now = Date.now();
	const endOfToday = new Date();
	endOfToday.setHours(23, 59, 59, 999);
	const due = (r: Reminder) => new Date(r.dueAt).getTime();
	const overdue = items.filter((r) => due(r) < now);
	const today = items.filter((r) => due(r) >= now && due(r) <= endOfToday.getTime());
	const upcoming = items.filter((r) => due(r) > endOfToday.getTime());

	const Group = ({ label, list }: { label: string; list: Reminder[] }) =>
		list.length === 0 ? null : (
			<section className="space-y-2">
				<h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
					{label} <span className="text-neutral-400">({list.length})</span>
				</h2>
				<ul className="space-y-2">
					{list.map((r) => (
						<li key={r.id} className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-3">
							<span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
								{TYPE_LABEL[r.type]}
							</span>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium text-neutral-900">{r.title}</p>
								<p className="text-xs text-neutral-500">{new Date(r.dueAt).toLocaleString()}</p>
							</div>
							<button
								title="Snooze to tomorrow"
								onClick={() => patch(r.id, { dueAt: startOfTomorrow().toISOString() })}
								className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
							>
								<Clock className="h-4 w-4" />
							</button>
							<button
								title="Mark done"
								onClick={() => patch(r.id, { status: "done" })}
								className="rounded-full p-2 text-emerald-500 hover:bg-emerald-50"
							>
								<Check className="h-4 w-4" />
							</button>
							<button
								title="Delete"
								onClick={() => remove(r.id)}
								className="rounded-full p-2 text-red-400 hover:bg-red-50"
							>
								<Trash2 className="h-4 w-4" />
							</button>
						</li>
					))}
				</ul>
			</section>
		);

	return (
		<div className="mx-auto w-full max-w-3xl space-y-6 p-4">
			<div className="flex items-center gap-3">
				<BellRing className="h-6 w-6 text-blue-600" />
				<h1 className="text-2xl font-semibold text-neutral-900">Reminders & tasks</h1>
			</div>

			<div className="rounded-2xl border border-blue-100 bg-white p-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
					<div className="flex-1 space-y-1">
						<Label htmlFor="rtitle">What do you need to do?</Label>
						<Input
							id="rtitle"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Call the client back, reply to invoice…"
							onKeyDown={(e) => e.key === "Enter" && create()}
						/>
					</div>
					<div className="space-y-1">
						<Label htmlFor="rtype">Type</Label>
						<select
							id="rtype"
							value={type}
							onChange={(e) => setType(e.target.value as Reminder["type"])}
							className="h-10 rounded-xl border border-blue-100 bg-white px-3 text-sm"
						>
							{Object.entries(TYPE_LABEL).map(([v, l]) => (
								<option key={v} value={v}>
									{l}
								</option>
							))}
						</select>
					</div>
					<div className="space-y-1">
						<Label htmlFor="rdue">Due</Label>
						<Input id="rdue" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="w-52" />
					</div>
					<Button onClick={create} disabled={saving} className="rounded-full">
						{saving ? "Adding…" : "Add"}
					</Button>
				</div>
			</div>

			{loading ? (
				<p className="text-sm text-neutral-500">Loading…</p>
			) : items.length === 0 ? (
				<p className="rounded-2xl border border-dashed border-blue-100 bg-white/60 p-8 text-center text-sm text-neutral-500">
					No open reminders. Add one above, or create one from an email.
				</p>
			) : (
				<div className="space-y-6">
					<Group label="Overdue" list={overdue} />
					<Group label="Today" list={today} />
					<Group label="Upcoming" list={upcoming} />
				</div>
			)}
		</div>
	);
}

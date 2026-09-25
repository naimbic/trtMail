import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { createOrUpdateContact, deleteContactsByIds, listContacts } from "@/lib/contacts/service";

/** GET /api/contacts/directory?q= — the current user's address book. */
export async function GET(request: Request) {
	const env = getEnv();
	const user = await requireUser(env, request);
	const url = new URL(request.url);
	const q = url.searchParams.get("q") ?? undefined;
	const rows = await listContacts(env, user.id, q);
	return NextResponse.json({ contacts: rows });
}

/** POST /api/contacts/directory — create (or upsert by email) a contact. */
export async function POST(request: Request) {
	const env = getEnv();
	const user = await requireUser(env, request);
	const body = (await request.json().catch(() => ({}))) as {
		email?: string;
		displayName?: string;
		company?: string;
		phone?: string;
	};
	if (!body.email?.trim()) {
		return NextResponse.json({ error: "Email is required" }, { status: 400 });
	}
	try {
		const contact = await createOrUpdateContact(env, user.id, {
			email: body.email,
			displayName: body.displayName,
			company: body.company,
			phone: body.phone,
		});
		return NextResponse.json({ contact });
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Could not save contact" },
			{ status: 400 },
		);
	}
}

/** DELETE /api/contacts/directory — bulk delete by ids (+ their avatar blobs). */
export async function DELETE(request: Request) {
	const env = getEnv();
	const user = await requireUser(env, request);
	const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
	const ids = (body.ids ?? []).filter(Boolean);
	if (ids.length === 0) return NextResponse.json({ error: "No contacts selected" }, { status: 400 });
	const { deletedKeys } = await deleteContactsByIds(env, user.id, ids);
	await Promise.all(deletedKeys.map((key) => env.BUCKET.delete(key).catch(() => {})));
	return NextResponse.json({ ok: true, deleted: ids.length });
}

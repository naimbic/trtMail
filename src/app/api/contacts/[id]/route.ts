import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { deleteContactsByIds, getContactRecord, updateContactRecord } from "@/lib/contacts/service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
	const { id } = await params;
	const env = getEnv();
	const user = await requireUser(env, request);
	const body = (await request.json().catch(() => ({}))) as {
		displayName?: string;
		company?: string;
		phone?: string;
	};
	const contact = await updateContactRecord(env, user.id, id, body);
	if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
	return NextResponse.json({ contact });
}

export async function DELETE(request: Request, { params }: Params) {
	const { id } = await params;
	const env = getEnv();
	const user = await requireUser(env, request);
	const existing = await getContactRecord(env, user.id, id);
	if (!existing) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
	const { deletedKeys } = await deleteContactsByIds(env, user.id, [id]);
	await Promise.all(deletedKeys.map((key) => env.BUCKET.delete(key).catch(() => {})));
	return NextResponse.json({ ok: true });
}

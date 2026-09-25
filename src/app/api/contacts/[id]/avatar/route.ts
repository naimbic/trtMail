import { NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { getContactRecord, setContactAvatarKey } from "@/lib/contacts/service";

type Params = { params: Promise<{ id: string }> };

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** POST /api/contacts/[id]/avatar — upload an avatar image (multipart, field "file"). */
export async function POST(request: Request, { params }: Params) {
	const { id } = await params;
	const env = getEnv();
	const user = await requireUser(env, request);
	const existing = await getContactRecord(env, user.id, id);
	if (!existing) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

	const form = await request.formData();
	const file = form.get("file");
	if (!(file instanceof File) || file.size === 0) {
		return NextResponse.json({ error: "No image provided" }, { status: 400 });
	}
	if (file.size > MAX_AVATAR_BYTES) {
		return NextResponse.json({ error: "Image must be 2 MB or smaller" }, { status: 400 });
	}
	const type = file.type || "application/octet-stream";
	if (!ALLOWED.has(type)) {
		return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
	}

	const key = `contacts/${id}/avatar`;
	await env.BUCKET.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: type } });
	// Bust caches on the serving URL by appending the byte size as a version tag.
	await setContactAvatarKey(env, user.id, id, key);
	return NextResponse.json({ ok: true, avatarUrl: `/api/contacts/${id}/avatar?v=${file.size}` });
}

/** GET /api/contacts/[id]/avatar — stream the stored avatar image. */
export async function GET(request: Request, { params }: Params) {
	const { id } = await params;
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) return new Response("Unauthorized", { status: 401 });
	const contact = await getContactRecord(env, user.id, id);
	if (!contact?.avatarKey) return new Response("Not found", { status: 404 });

	const object = await env.BUCKET.get(contact.avatarKey);
	if (!object) return new Response("Not found", { status: 404 });
	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("Cache-Control", "private, max-age=3600");
	headers.set("X-Content-Type-Options", "nosniff");
	return new Response(object.body, { headers });
}

/** DELETE /api/contacts/[id]/avatar — remove the avatar. */
export async function DELETE(request: Request, { params }: Params) {
	const { id } = await params;
	const env = getEnv();
	const user = await requireUser(env, request);
	const contact = await getContactRecord(env, user.id, id);
	if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
	if (contact.avatarKey) await env.BUCKET.delete(contact.avatarKey).catch(() => {});
	await setContactAvatarKey(env, user.id, id, null);
	return NextResponse.json({ ok: true });
}

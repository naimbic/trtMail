import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { folders } from "@/db/schema";
import { requireUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { getMailboxFolderAccess } from "../utils";

/** PATCH /api/folders/[id] — rename (and/or recolor) a custom folder. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const env = getEnv();
	const user = await requireUser(env, request);
	const body = (await request.json().catch(() => ({}))) as { name?: string; color?: string };
	const name = body.name?.trim();
	if (name !== undefined && (name.length === 0 || name.length > 60)) {
		return NextResponse.json({ error: "Folder name must be 1–60 characters" }, { status: 400 });
	}
	const db = getDb(env);
	const [folder] = await db.select().from(folders).where(eq(folders.id, id)).limit(1);
	if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
	const access = await getMailboxFolderAccess(db, user, folder.mailboxId);
	if (!access?.canManage) return NextResponse.json({ error: "Folder not found" }, { status: 404 });

	if (name && name !== folder.name) {
		const [clash] = await db
			.select({ id: folders.id })
			.from(folders)
			.where(and(eq(folders.mailboxId, folder.mailboxId), eq(folders.name, name), ne(folders.id, id)))
			.limit(1);
		if (clash) return NextResponse.json({ error: "A folder with that name already exists" }, { status: 409 });
	}

	await db
		.update(folders)
		.set({ ...(name ? { name } : {}), ...(body.color ? { color: body.color } : {}) })
		.where(eq(folders.id, id));
	const [updated] = await db.select().from(folders).where(eq(folders.id, id)).limit(1);
	return NextResponse.json({ folder: updated });
}

/** DELETE /api/folders/[id] — remove a custom folder. Messages in it keep existing
 * (schema sets messages.folderId to null on folder delete), so nothing is lost. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const env = getEnv();
	const user = await requireUser(env, request);
	const db = getDb(env);

	const [folder] = await db.select().from(folders).where(eq(folders.id, id)).limit(1);
	if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });

	const access = await getMailboxFolderAccess(db, user, folder.mailboxId);
	if (!access?.canManage) return NextResponse.json({ error: "Folder not found" }, { status: 404 });

	await db.delete(folders).where(eq(folders.id, id));
	return NextResponse.json({ ok: true });
}

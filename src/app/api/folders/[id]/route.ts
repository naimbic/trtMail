import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { folders } from "@/db/schema";
import { requireUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { getMailboxFolderAccess } from "../utils";

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

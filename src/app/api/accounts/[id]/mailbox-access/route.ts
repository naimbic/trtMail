import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { mailboxAccess, mailboxes, domains, users } from "@/db/schema";
import { newId } from "@/lib/ids";
import { assertCan } from "@/lib/auth/roles";
import { createAuditLog } from "@/lib/mailboxes/audit";
import { requireTeamAdmin } from "../../utils";
import type { AccountRouteParams } from "../types";

const PERMISSIONS = ["read_only", "send_as", "send_on_behalf", "full_access"] as const;

// GET — grants held by this account (which shared mailboxes it can access, at what permission).
export async function GET(request: Request, { params }: AccountRouteParams) {
	const access = await requireTeamAdmin(request);
	if (access.error) return access.error;
	const { id } = await params;
	const db = getDb(access.env);
	const rows = await db
		.select({
			id: mailboxAccess.id,
			mailboxId: mailboxAccess.mailboxId,
			permission: mailboxAccess.permission,
			localPart: mailboxes.localPart,
			hostname: domains.hostname,
		})
		.from(mailboxAccess)
		.innerJoin(mailboxes, eq(mailboxAccess.mailboxId, mailboxes.id))
		.innerJoin(domains, eq(mailboxes.domainId, domains.id))
		.where(eq(mailboxAccess.userId, id));
	return NextResponse.json({
		grants: rows.map((r) => ({
			id: r.id,
			mailboxId: r.mailboxId,
			address: `${r.localPart}@${r.hostname}`,
			permission: r.permission,
		})),
	});
}

// POST — grant/update a mailbox for this account.
export async function POST(request: Request, { params }: AccountRouteParams) {
	const access = await requireTeamAdmin(request);
	if (access.error) return access.error;
	try {
		assertCan(access.user!, "assignMailboxAccess");
	} catch {
		return NextResponse.json({ error: "You cannot assign mailbox access" }, { status: 403 });
	}
	const { id } = await params;
	const body = (await request.json().catch(() => ({}))) as { mailboxId?: string; permission?: string };
	const permission = PERMISSIONS.includes(body.permission as (typeof PERMISSIONS)[number])
		? (body.permission as (typeof PERMISSIONS)[number])
		: "read_only";
	if (!body.mailboxId) return NextResponse.json({ error: "mailboxId is required" }, { status: 400 });

	const db = getDb(access.env);
	const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
	if (!target) return NextResponse.json({ error: "Account not found" }, { status: 404 });
	const [mbx] = await db.select({ id: mailboxes.id }).from(mailboxes).where(eq(mailboxes.id, body.mailboxId)).limit(1);
	if (!mbx) return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });

	const [existing] = await db
		.select({ id: mailboxAccess.id })
		.from(mailboxAccess)
		.where(and(eq(mailboxAccess.mailboxId, body.mailboxId), eq(mailboxAccess.userId, id)))
		.limit(1);
	if (existing) {
		await db.update(mailboxAccess).set({ permission }).where(eq(mailboxAccess.id, existing.id));
	} else {
		await db.insert(mailboxAccess).values({
			id: newId("mba"),
			mailboxId: body.mailboxId,
			userId: id,
			permission,
			createdByUserId: access.user!.id,
		});
	}
	await createAuditLog(access.env, {
		actorUserId: access.user!.id,
		targetUserId: id,
		mailboxId: body.mailboxId,
		action: "mailbox_access.grant",
		metadata: { permission },
	}).catch(() => {});
	return NextResponse.json({ ok: true });
}

// DELETE — revoke this account's access to a mailbox (?mailboxId=…).
export async function DELETE(request: Request, { params }: AccountRouteParams) {
	const access = await requireTeamAdmin(request);
	if (access.error) return access.error;
	try {
		assertCan(access.user!, "assignMailboxAccess");
	} catch {
		return NextResponse.json({ error: "You cannot assign mailbox access" }, { status: 403 });
	}
	const { id } = await params;
	const mailboxId = new URL(request.url).searchParams.get("mailboxId");
	if (!mailboxId) return NextResponse.json({ error: "mailboxId is required" }, { status: 400 });
	const db = getDb(access.env);
	await db.delete(mailboxAccess).where(and(eq(mailboxAccess.mailboxId, mailboxId), eq(mailboxAccess.userId, id)));
	await createAuditLog(access.env, {
		actorUserId: access.user!.id,
		targetUserId: id,
		mailboxId,
		action: "mailbox_access.revoke",
	}).catch(() => {});
	return NextResponse.json({ ok: true });
}

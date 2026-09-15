import { NextResponse } from "next/server";
import { and, asc, eq, gt, gte, lt, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getEnv } from "@/lib/cloudflare";
import { authenticateApiKey, requireScope } from "@/lib/api/auth";
import { getDb } from "@/db";
import { messages, users } from "@/db/schema";
import { listAccessibleMailboxes } from "@/lib/mailboxes/access";

// Read-only feed. The bridge checkpoints only after CRM acknowledgement.
export async function GET(request: Request) {
 const auth = await authenticateApiKey(getEnv(), request.headers.get("authorization"));
 if (!auth || !requireScope(auth.scopes, "read")) return NextResponse.json({error:"Unauthorized"},{status:401});
 const url = new URL(request.url);
 const mailbox = (url.searchParams.get("mailbox") || "").toLowerCase();
 const limit = Number(url.searchParams.get("limit") || 50);
 const since = Number(url.searchParams.get("since"));
 if (!/^[^\s@]+@[^\s@]+$/.test(mailbox) || !Number.isInteger(limit) || limit<1 || limit>100 || !url.searchParams.has("since") || !Number.isSafeInteger(since) || since<0)
  return NextResponse.json({error:"Valid mailbox, since (Unix seconds), and limit (1–100) required"},{status:400});
 let cursor: {time:number;id:string}|null=null;
 if(url.searchParams.has("cursor")) {
  try {cursor=JSON.parse(Buffer.from(url.searchParams.get("cursor")!,"base64url").toString());
   if(!cursor || !Number.isSafeInteger(cursor.time) || cursor.time<since || typeof cursor.id!=="string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(cursor.id)) throw new Error();
  }catch{return NextResponse.json({error:"Invalid cursor"},{status:400});}
 }
 const db=getDb(getEnv());
 const [user]=await db.select().from(users).where(eq(users.id,auth.userId)).limit(1);
 if(!user || user.disabled)return NextResponse.json({error:"Unauthorized"},{status:401});
 const accessible=await listAccessibleMailboxes(db,user);
 const box=accessible.find(b=>`${b.localPart}@${b.hostname}`.toLowerCase()===mailbox);
 if(!box)return NextResponse.json({error:"Mailbox not found or not accessible"},{status:404});
 // Leave a small settling interval so messages committed during pagination are picked up later.
 const cutoff=Math.floor(Date.now()/1000)-60;
 const conditions:SQL[]=[eq(messages.mailboxId,box.id),eq(messages.direction,"inbound"),gte(messages.createdAt,new Date(since*1000)),lt(messages.createdAt,new Date(cutoff*1000))];
 if(cursor)conditions.push(or(gt(messages.createdAt,new Date(cursor.time*1000)),and(eq(messages.createdAt,new Date(cursor.time*1000)),gt(messages.id,cursor.id)))!);
 const rows=await db.select({id:messages.id,providerMessageId:messages.providerMessageId,from:messages.fromAddr,to:messages.toAddr,subject:messages.subject,text:sql<string | null>`substr(${messages.textBody},1,20000)`,html:sql<string | null>`CASE WHEN ${messages.textBody} IS NULL OR ${messages.textBody} = '' THEN substr(${messages.htmlBody},1,40000) ELSE NULL END`,status:messages.status,createdAt:messages.createdAt})
  .from(messages).where(and(...conditions)).orderBy(asc(messages.createdAt),asc(messages.id)).limit(limit+1);
 const batch=rows.slice(0,limit),last=batch.at(-1);
 const nextCursor=last?Buffer.from(JSON.stringify({time:Math.floor(last.createdAt.getTime()/1000),id:last.id})).toString("base64url"):url.searchParams.get("cursor");
 return NextResponse.json({messages:batch.map(m=>({...m,mailbox})),nextCursor,hasMore:rows.length>limit},{headers:{"Cache-Control":"no-store"}});
}

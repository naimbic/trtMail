import { requireUser } from '@/lib/auth/cookies';
import { assertAdmin } from '@/lib/auth/admin';
import { getServerDatabase,getServerEnv } from '@/lib/server/runtime';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{assertAdmin(await requireUser(getServerEnv(),request));}catch{return Response.json({error:'Forbidden'},{status:403});}
 const db=getServerDatabase().sqlite;
 const sync=db.prepare("SELECT value FROM _cf_server_state WHERE key='imap-health'").get();
 return Response.json({storage:'SQLite + persistent files',smtpConfigured:!!process.env.SMTP_HOST && !!process.env.SMTP_PASSWORD,imapConfigured:!!process.env.IMAP_HOST && !!process.env.IMAP_PASSWORD,sync:sync?JSON.parse(String(sync.value)):null,jobs:db.prepare('SELECT status,count(*) AS count FROM _cf_server_jobs GROUP BY status').all()});
}

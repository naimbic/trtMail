import { getServerEnv, getServerDatabase } from './runtime';
import { getDb } from '@/db';
import { users, domains, mailboxes } from '@/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { newId } from '@/lib/ids';
import { eq } from 'drizzle-orm';
export async function bootstrap() {
 const env=getServerEnv(), db=getDb(env);
 if((await db.select({id:users.id}).from(users).where(eq(users.role,'admin')).limit(1)).length)return;
 const email=process.env.ADMIN_EMAIL?.trim().toLowerCase(), password=process.env.ADMIN_PASSWORD;
 const address=process.env.MAIL_ADDRESS?.trim().toLowerCase();
 if(!email || !password || password.length<16 || !address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))throw new Error('First startup requires ADMIN_EMAIL, ADMIN_PASSWORD (at least 16 characters) and MAIL_ADDRESS.');
 const owner=newId('usr'), domain=newId('dom'), mailbox=newId('mbx');
 const [localPart,hostname]=address.split('@');
 // The same process owns initialization before web and job processes are started.
 await db.batch([
   db.insert(users).values({id:owner,email,name:'Administrator',passwordHash:hashPassword(password),role:'admin'}),
   db.insert(domains).values({id:domain,userId:owner,hostname,zoneId:`smtp:${hostname}`,status:'active',routingStatus:'managed-by-mail-provider',routingEnabled:Boolean(process.env.IMAP_HOST),sendingEnabled:Boolean(process.env.SMTP_HOST)}),
   db.insert(mailboxes).values({id:mailbox,userId:owner,domainId:domain,localPart,displayName:address,useAllDomains:false})
 ]);
 // Never reset existing accounts on redeploy.
 getServerDatabase().sqlite.prepare("INSERT OR REPLACE INTO _cf_server_state VALUES ('bootstrap','complete')").run();
 console.log('Initial administrator and mailbox created.');
}

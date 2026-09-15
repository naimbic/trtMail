import { ImapFlow } from 'imapflow';
import { createHash } from 'node:crypto';
import type { ImapImportInput } from '../import/imap-types';
import { getServerDatabase, getServerEnv } from './runtime';
import { parseRawMime } from '../email/parse';
export function imapClient(input:Omit<ImapImportInput,'folder'|'limit'>) {
 // Browser-supplied hosts must match an operator-approved host; avoids opening arbitrary server sockets.
 const hosts=(process.env.IMAP_ALLOWED_HOSTS||process.env.IMAP_HOST||'').split(',').map(s=>s.trim().toLowerCase());
 if(!hosts.includes(input.host.toLowerCase()))throw new Error('IMAP host must be approved in IMAP_ALLOWED_HOSTS.');
 if(!input.secure && process.env.IMAP_ALLOW_INSECURE!=='true')throw new Error('IMAP requires TLS. Use port 993.');
 return new ImapFlow({host:input.host,port:input.port,secure:input.secure,auth:{user:input.username,pass:input.password},logger:false,connectionTimeout:15000,socketTimeout:60000});
}
export async function fetchNodeImapMessages(input:ImapImportInput) {
 const client=imapClient(input);await client.connect();
 try {
  const lock=await client.getMailboxLock(input.folder,{readOnly:true});
  try {
   const ids=await client.search({all:true},{uid:true});const selected=(ids||[]).slice(-Math.min(input.limit,100));
   const result:{filename:string;raw:ArrayBuffer}[]=[];
   for(const uid of selected){const info=await client.fetchOne(String(uid),{size:true},{uid:true});if(info && (info.size??0)>25*1024*1024)throw new Error('Message exceeds 25 MB');const item=await client.fetchOne(String(uid),{source:true,size:true},{uid:true});if(!item||!item.source)continue;if(item.source.length>25*1024*1024)throw new Error('Message exceeds 25 MB');result.push({filename:`${input.folder}-${uid}.eml`,raw:new Uint8Array(item.source).buffer});}
   return result;
  }finally{lock.release();}
 }finally{await client.logout().catch(()=>client.close());}
}
export async function listNodeImapFolders(input:Omit<ImapImportInput,'folder'|'limit'>) {
 const client=imapClient(input);await client.connect();try{return (await client.list()).map(f=>f.path);}finally{await client.logout().catch(()=>client.close());}
}
export async function syncInbox() {
 if(!process.env.IMAP_HOST || !process.env.IMAP_PASSWORD)return {enabled:false};
 const address=process.env.MAIL_ADDRESS?.toLowerCase();if(!address)throw new Error('MAIL_ADDRESS missing');
 const client=imapClient({host:process.env.IMAP_HOST,port:Number(process.env.IMAP_PORT||993),secure:process.env.IMAP_SECURE!=='false',username:process.env.IMAP_USER||address,password:process.env.IMAP_PASSWORD||''});
 await client.connect();
 try {
  const folder=process.env.IMAP_FOLDER||'INBOX';const lock=await client.getMailboxLock(folder,{readOnly:true});
  try {
   if(!client.mailbox)throw new Error('IMAP mailbox unavailable');
   const db=getServerDatabase().sqlite,env=getServerEnv();
   const key='imap:'+createHash('sha256').update([process.env.IMAP_HOST,process.env.IMAP_USER,address,folder,String(client.mailbox.uidValidity)].join('|')).digest('hex');
   const saved=db.prepare('SELECT value FROM _cf_server_state WHERE key=?').get(key);
   let last=saved ? Number(saved.value) : Math.max(0,client.mailbox.uidNext-1-Math.min(Number(process.env.IMAP_INITIAL_LIMIT||0),100));
   if(!saved)db.prepare('INSERT INTO _cf_server_state VALUES (?,?)').run(key,String(last));
   // Explicit upper bound avoids IMAP n:* returning the last message when n exceeds UIDNEXT.
   const upper=client.mailbox.uidNext-1;
   if(last>=upper)return {enabled:true,queued:0};
   const found=await client.search({uid:`${last+1}:${upper}`},{uid:true});
   const ids=(found||[]).filter(id=>id>last).sort((a,b)=>a-b).slice(0,50);
   for(const uid of ids){
    const info=await client.fetchOne(String(uid),{size:true},{uid:true});if(!info)continue;
    if((info.size??0)>25*1024*1024)throw new Error('Incoming message exceeds 25 MB; sync paused for operator review.');
    const mail=await client.fetchOne(String(uid),{source:true},{uid:true});if(!mail||!mail.source)continue;
    const parsed=await parseRawMime(new Uint8Array(mail.source).buffer);
    const jobId=createHash('sha256').update(`${key}:${uid}`).digest('hex');const rawR2Key=`inbound/${jobId}.eml`;
    await env.BUCKET.put(rawR2Key,new Uint8Array(mail.source),{httpMetadata:{contentType:'message/rfc822'}});
    // Persist receipt and cursor together. A crash before this transaction only leaves a harmless object.
    db.exec('BEGIN IMMEDIATE');
    try {db.prepare('INSERT OR IGNORE INTO _cf_server_jobs(id,kind,payload) VALUES (?,?,?)').run(jobId,'inbound',JSON.stringify({from:parsed.fromAddr||'',to:address,rawR2Key,headers:parsed.headers}));db.prepare('INSERT OR REPLACE INTO _cf_server_state VALUES (?,?)').run(key,String(uid));db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
    last=uid;
   }
   return {enabled:true,queued:ids.length};
  }finally{lock.release();}
 }finally{await client.logout().catch(()=>client.close());}
}

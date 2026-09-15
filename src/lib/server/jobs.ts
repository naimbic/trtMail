import { getServerDatabase,getServerEnv,enqueue } from './runtime';
import { processInboundMessage } from '../email/inbound';
import { createScheduledBackupIfDue,getBackupSettings } from '../backups/service';
import { exportDatabaseRecords } from '../backups/export';
import { syncInbox } from './imap';

async function backup(id:string) {
 const db=getServerDatabase(),env=getServerEnv();
 db.sqlite.prepare("UPDATE backups SET status='running',started_at=? WHERE id=?").run(Math.floor(Date.now()/1000),id);
 try {
  // SQLite snapshot for a consistent read across all exported tables.
  db.sqlite.exec('BEGIN');let content:Uint8Array;
  try{content=await exportDatabaseRecords(env.DB);db.sqlite.exec('COMMIT');}catch(e){db.sqlite.exec('ROLLBACK');throw e;}
  const filename=`trtmail-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,key=`backups/database/${id}/${filename}`;
  const object=await env.BUCKET.put(key,content,{httpMetadata:{contentType:'application/json'}});
  db.sqlite.prepare("UPDATE backups SET status='completed',filename=?,r2_key=?,size=?,completed_at=?,error=NULL WHERE id=?").run(filename,key,object.size,Math.floor(Date.now()/1000),id);
 }catch(error){db.sqlite.prepare("UPDATE backups SET status='failed',error='Backup job failed',completed_at=? WHERE id=?").run(Math.floor(Date.now()/1000),id);throw error;}
}
export async function runJobs() {
 const db=getServerDatabase().sqlite,env=getServerEnv();
 const rows=db.prepare("SELECT * FROM _cf_server_jobs WHERE status='queued' AND available_at<=? ORDER BY rowid LIMIT 25").all(Date.now());
 for(const row of rows){
  if(db.prepare("UPDATE _cf_server_jobs SET status='running' WHERE id=? AND status='queued'").run(row.id).changes!==1)continue;
  try {
   const payload=JSON.parse(String(row.payload));
   if(row.kind==='backup')await backup(payload.backupId);
   else if(row.kind==='inbound') {
    const existing=db.prepare('SELECT id FROM messages WHERE raw_r2_key=?').get(payload.rawR2Key);
    if(!existing)await processInboundMessage(env,payload);
   }else throw new Error('Unsupported background job');
   db.prepare("UPDATE _cf_server_jobs SET status='completed',payload='{}',error=NULL WHERE id=?").run(row.id);
  }catch {
   const attempts=Number(row.attempts)+1;
   db.prepare('UPDATE _cf_server_jobs SET status=?,attempts=?,available_at=?,error=? WHERE id=?').run(attempts>=5?'failed':'queued',attempts,Date.now()+Math.min(600000,10000*2**attempts),'Processing failed; review worker logs and configuration',row.id);
   console.error(`Background ${row.kind} job failed (${attempts}/5).`);
  }
 }
}
export async function workerCycle() {
 const env=getServerEnv(), db=getServerDatabase().sqlite;
 try{await syncInbox();db.prepare("INSERT OR REPLACE INTO _cf_server_state VALUES ('imap-health',?)").run(JSON.stringify({ok:true,at:new Date().toISOString(),enabled:!!process.env.IMAP_HOST && !!process.env.IMAP_PASSWORD}));}catch{db.prepare("INSERT OR REPLACE INTO _cf_server_state VALUES ('imap-health',?)").run(JSON.stringify({ok:false,at:new Date().toISOString()}));console.error('IMAP sync failed; check provider credentials, TLS and mailbox settings.');}
 const id=await createScheduledBackupIfDue(env,new Date());if(id)enqueue('backup',{backupId:id},`scheduled-${id}`);
 await runJobs();
 const settings=await getBackupSettings(env);
 if(settings?.retentionEnabled){const expired=db.prepare("SELECT id,r2_key FROM backups WHERE status IN ('completed','failed') AND created_at<?").all(Math.floor(Date.now()/1000)-settings.retentionDays*86400);for(const row of expired){if(row.r2_key)await env.BUCKET.delete(String(row.r2_key));db.prepare('DELETE FROM backups WHERE id=?').run(row.id);}}
 db.prepare("DELETE FROM _cf_server_state WHERE key LIKE 'login:%' AND CAST(substr(key,instr(substr(key,7),':')+7) AS INTEGER)<?").run(Math.floor(Date.now()/60000)-60);
 db.prepare("INSERT OR REPLACE INTO _cf_server_state VALUES ('worker-heartbeat',?)").run(new Date().toISOString());
}

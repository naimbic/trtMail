import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Server } from 'node:net';
import { SqliteDatabase } from '../../src/lib/server/database';
import { FileBucket } from '../../src/lib/server/storage';
import { bootstrap } from '../../src/lib/server/bootstrap';
import { getServerDatabase, getServerEnv, enqueue } from '../../src/lib/server/runtime';
import { getDb } from '../../src/db';
import { users, mailboxes, messages } from '../../src/db/schema';
import { sendEmail } from '../../src/lib/email/send';
import { runJobs } from '../../src/lib/server/jobs';
import { syncInbox } from '../../src/lib/server/imap';
import { createBackupRecord } from '../../src/lib/backups/service';
import { exportDatabaseRecords, restoreDatabaseRecords } from '../../src/lib/backups/export';
const root=mkdtempSync(join(tmpdir(),'mailflare-runtime-'));
after(()=>rmSync(root,{recursive:true,force:true}));
async function listen(server:Server){await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));return (server.address() as {port:number}).port;}

// All network tests use loopback fixtures, never a real mailbox or recipient.
test('Coolify runtime',async t=>{
 await t.test('SQLite migrations persist and failed batches roll back',async()=>{
  const path=join(root,'db-test.sqlite');const db=new SqliteDatabase(path);db.migrate();db.migrate();
  await db.exec('CREATE TABLE test_row(id INTEGER PRIMARY KEY,value TEXT)');
  await assert.rejects(db.batch([db.prepare('INSERT INTO test_row VALUES (?,?)').bind(1,'first'),db.prepare('INSERT INTO test_row VALUES (?,?)').bind(1,'duplicate')]));
  assert.equal(await db.prepare('SELECT count(*) AS n FROM test_row').first('n'),0);
  await db.prepare('INSERT INTO test_row VALUES (?,?)').bind(2,'persisted').run();db.sqlite.close();
  const reopened=new SqliteDatabase(path);assert.deepEqual(await reopened.prepare('SELECT value FROM test_row').raw(),[['persisted']]);reopened.sqlite.close();
 });
 await t.test('File storage is binary safe, persistent and path traversal safe',async()=>{
  const bucket=new FileBucket(join(root,'objects'));const payload=new Uint8Array([0,255,1,2]);
  await bucket.put('../../escape',payload,{httpMetadata:{contentType:'application/octet-stream'}});
  const saved=await new FileBucket(join(root,'objects')).get('../../escape');assert.deepEqual(new Uint8Array(await saved!.arrayBuffer()),payload);
  assert.equal(saved!.httpMetadata.contentType,'application/octet-stream');
  const part=await bucket.get('../../escape',{range:{offset:1,length:2}});assert.deepEqual(new Uint8Array(await part!.arrayBuffer()),new Uint8Array([255,1]));
  await bucket.delete('../../escape');assert.equal(await bucket.get('../../escape'),null);
 });
 const deliveries:string[]=[];
 const smtp=createServer(socket=>{
  socket.setEncoding('utf8');socket.write('220 test.local ESMTP\r\n');let buffer='',data=false;
  socket.on('data',chunk=>{buffer+=chunk;while(buffer.includes('\r\n')){
   if(data){const end=buffer.indexOf('\r\n.\r\n');if(end<0)return;deliveries.push(buffer.slice(0,end));buffer=buffer.slice(end+5);data=false;socket.write('250 queued\r\n');continue;}
   const end=buffer.indexOf('\r\n'),line=buffer.slice(0,end);buffer=buffer.slice(end+2);
   if(/^EHLO|^HELO/i.test(line))socket.write('250 test.local\r\n');else if(/^DATA/i.test(line)){data=true;socket.write('354 send data\r\n');}else if(/^QUIT/i.test(line)){socket.end('221 bye\r\n');}else socket.write('250 OK\r\n');
  }});
 });
 const smtpPort=await listen(smtp);
 Object.assign(process.env,{DATA_DIR:join(root,'app'),ADMIN_EMAIL:'owner@example.test',ADMIN_PASSWORD:'Test-Only-Long-Password-123!',MAIL_ADDRESS:'hello@example.test',MAIL_DOMAINS:'example.test',SMTP_HOST:'127.0.0.1',SMTP_PORT:String(smtpPort),SMTP_ALLOW_INSECURE:'true',SMTP_ALLOWED_FROM:'hello@example.test'});
 delete process.env.SMTP_USER;delete process.env.SMTP_PASSWORD;
 try {
  await t.test('First startup creates owner, mailbox and persistent session schema once',async()=>{await bootstrap();await bootstrap();assert.equal((await getDb(getServerEnv()).select().from(users)).length,1);assert.equal((await getDb(getServerEnv()).select().from(mailboxes)).length,1);});
  await t.test('SMTP sends MIME with attachment and rejects unauthorized sender',async()=>{
   const env=getServerEnv(),db=getDb(env),[user]=await db.select().from(users),[mailbox]=await db.select().from(mailboxes);
   const sent=await sendEmail(env,{userId:user.id,mailboxId:mailbox.id,from:'hello@example.test',to:'recipient@example.test',subject:'Local SMTP test',text:'Test body',attachments:[{filename:'note.txt',type:'text/plain',content:new TextEncoder().encode('attachment test').buffer,disposition:'attachment',contentId:null}]});
   assert.ok(sent.messageId);assert.equal(deliveries.length,1);assert.match(deliveries[0],/note.txt/);assert.equal((await db.select().from(messages))[0].status,'sent');
   await assert.rejects(env.EMAIL.send({from:'other@example.test',to:'recipient@example.test',subject:'blocked',text:'blocked'}));assert.equal(deliveries.length,1);
  });
  let present=false;const commands:string[]=[];
  const raw='From: Client <client@example.test>\r\nTo: hello@example.test\r\nSubject: Demande de devis SEO\r\nMessage-ID: <test-inbound@example.test>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nBonjour, je souhaite un devis SEO.';
  const imap=createServer(socket=>{
   socket.setEncoding('utf8');socket.write('* OK test IMAP ready\r\n');let buffer='';
   socket.on('data',chunk=>{buffer+=chunk;while(buffer.includes('\r\n')){const end=buffer.indexOf('\r\n'),line=buffer.slice(0,end);buffer=buffer.slice(end+2);commands.push(line);const tag=line.split(' ')[0];
    if(/ CAPABILITY/i.test(line))socket.write('* CAPABILITY IMAP4rev1\r\n');
    else if(/ LIST /i.test(line))socket.write('* LIST (\\HasNoChildren) "/" "INBOX"\r\n');
    else if(/ EXAMINE | SELECT /i.test(line))socket.write(`* FLAGS (\\Seen)\r\n* ${present?1:0} EXISTS\r\n* OK [UIDVALIDITY 1] valid\r\n* OK [UIDNEXT ${present?2:1}] next\r\n`);
    else if(/ UID SEARCH /i.test(line))socket.write(`* SEARCH${present?' 1':''}\r\n`);
    else if(/ UID FETCH /i.test(line)){
     if(/BODY\.PEEK/i.test(line))socket.write(`* 1 FETCH (UID 1 RFC822.SIZE ${Buffer.byteLength(raw)} BODY[] {${Buffer.byteLength(raw)}}\r\n${raw})\r\n`);
     else socket.write(`* 1 FETCH (UID 1 RFC822.SIZE ${Buffer.byteLength(raw)})\r\n`);
    }else if(/ LOGOUT/i.test(line)){socket.write('* BYE logout\r\n');socket.end(`${tag} OK logout\r\n`);continue;}
    socket.write(`${tag} OK done\r\n`);
   }});
  });
  const imapPort=await listen(imap);Object.assign(process.env,{IMAP_HOST:'127.0.0.1',IMAP_ALLOWED_HOSTS:'127.0.0.1',IMAP_PORT:String(imapPort),IMAP_SECURE:'false',IMAP_ALLOW_INSECURE:'true',IMAP_USER:'hello@example.test',IMAP_PASSWORD:'fixture',IMAP_INITIAL_LIMIT:'0'});
  try{await t.test('IMAP ingests new mail, preserves read state, and does not duplicate on replay',async()=>{
   assert.equal((await syncInbox()).queued,0);present=true;assert.equal((await syncInbox()).queued,1);await runJobs();
   const db=getServerDatabase().sqlite;assert.equal(db.prepare("SELECT count(*) AS n FROM messages WHERE direction='inbound'").get()!.n,1);
   assert.equal((await syncInbox()).queued,0);await runJobs();assert.equal(db.prepare("SELECT count(*) AS n FROM messages WHERE direction='inbound'").get()!.n,1);
   assert.ok(commands.some(c=>/BODY\.PEEK/.test(c)));assert.ok(!commands.some(c=>/ STORE /.test(c)));
  });}finally{imap.close();}
  await t.test('Manual backup completes and restore failures leave data intact',async()=>{
   const env=getServerEnv(),id=await createBackupRecord(env,'manual');enqueue('backup',{backupId:id});await runJobs();
   const row=getServerDatabase().sqlite.prepare('SELECT * FROM backups WHERE id=?').get(id)!;assert.equal(row.status,'completed');assert.ok(await env.BUCKET.get(String(row.r2_key)));
   const content=await exportDatabaseRecords(env.DB);const document=JSON.parse(new TextDecoder().decode(content));document.tables.users[0].bad_column='invalid';
   await assert.rejects(restoreDatabaseRecords(env.DB,new TextEncoder().encode(JSON.stringify(document)).buffer));assert.equal((await getDb(env).select().from(users)).length,1);
  });
 }finally{smtp.close();}
});

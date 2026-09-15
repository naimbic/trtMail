import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { SqliteDatabase } from './database';
import { FileBucket } from './storage';
export const dataDirectory = () => resolve(/* turbopackIgnore: true */ process.env.DATA_DIR || './.data/server');
let database:SqliteDatabase;
let environment:CloudflareEnv;
export function getServerDatabase() {
  if(!database) { database=new SqliteDatabase(resolve(dataDirectory(),'mailflare.sqlite')); database.migrate(); }
  return database;
}
export function enqueue(kind:string,payload:unknown,id:string=randomUUID()) {
  getServerDatabase().sqlite.prepare('INSERT OR IGNORE INTO _cf_server_jobs (id,kind,payload) VALUES (?,?,?)').run(id,kind,JSON.stringify(payload));
  return {id};
}
export function getServerEnv():CloudflareEnv {
  if(environment)return environment;
  const db=getServerDatabase();
  const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',
    requireTLS:process.env.SMTP_SECURE!=='true' && process.env.SMTP_ALLOW_INSECURE!=='true',
    auth:process.env.SMTP_USER ? {user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined,
    connectionTimeout:15000,socketTimeout:60000,logger:false,debug:false});
  environment={...process.env,DB:db,BUCKET:new FileBucket(resolve(dataDirectory(),'objects')),
    ASSETS:{fetch:async(input:string)=>{const path=new URL(input).pathname; if(path!=='/trtmail-icon.svg')return new Response(null,{status:404});return new Response(readFileSync(resolve('public/trtmail-icon.svg')),{headers:{'Content-Type':'image/svg+xml'}});}},
    EMAIL:{send:async(input:any)=>{
      if(!process.env.SMTP_HOST || (process.env.SMTP_USER && !process.env.SMTP_PASSWORD))throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD in Coolify.');
      const allowed=(process.env.SMTP_ALLOWED_FROM||process.env.MAIL_ADDRESS||'').toLowerCase().split(',').map(s=>s.trim());
      const address=(input.from.match(/<([^>]+)>/)?.[1]||input.from).toLowerCase();
      if(!allowed.includes(address))throw new Error('This sender is not authorized by SMTP_ALLOWED_FROM');
      const result=await transporter.sendMail({...input,attachments:input.attachments?.map((a:any)=>({filename:a.filename,content:Buffer.from(a.content),contentType:a.type,contentDisposition:a.disposition,cid:a.contentId}))});
      if(!result.accepted?.length || result.rejected?.length)throw new Error('SMTP did not accept all recipients');
      return {messageId:result.messageId};
    }},
    DATABASE_BACKUP_WORKFLOW:{create:async({id,params}:any)=>enqueue('backup',params,id)},
    INBOUND_QUEUE:{send:async(body:unknown)=>enqueue('inbound',body)},
    OUTBOUND_QUEUE:{send:async(body:unknown)=>enqueue('outbound',body)},
    LOGIN_RATE_LIMIT:{limit:async({key}: {key:string})=>{
      const bucket=`login:${key.slice(0,128)}:${Math.floor(Date.now()/60000)}`;
      const row=db.sqlite.prepare("INSERT INTO _cf_server_state(key,value) VALUES (?, '1') ON CONFLICT(key) DO UPDATE SET value=CAST(value AS INTEGER)+1 RETURNING value").get(bucket);
      return {success:Number(row?.value)<=20};
    }},
  } as unknown as CloudflareEnv;
  return environment;
}

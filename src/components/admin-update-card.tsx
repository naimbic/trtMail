"use client";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth/client";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
export function AdminUpdateCard(){
 const {data}=useQuery({queryKey:['server-status'],queryFn:async()=>{const r=await authFetch('/api/server-status');if(!r.ok)throw new Error('Status unavailable');return r.json() as Promise<{smtpConfigured:boolean;imapConfigured:boolean;sync:{ok:boolean;at:string}|null}>;},refetchInterval:30000});
 return <Card><CardHeader><CardTitle>Mail server</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p>Outgoing SMTP: {data ? data.smtpConfigured?'Configured':'Not configured' : 'Loading…'}</p><p>Incoming IMAP: {data ? data.imapConfigured?'Configured':'Not configured' : 'Loading…'}</p><p>Last sync: {data?.sync ? `${data.sync.ok?'Successful':'Needs attention'} · ${data.sync.at}`:'Waiting for mail worker'}</p><p className="text-neutral-500">Application updates are deployed through Coolify. Your mail data remains on the persistent volume.</p></CardContent></Card>;
}

"use client";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth/client";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
export function AdminUpdateCard(){
 const {data}=useQuery({queryKey:['server-status'],queryFn:async()=>{const r=await authFetch('/api/server-status');if(!r.ok)throw new Error('Status unavailable');return r.json() as Promise<{smtpConfigured:boolean;imapConfigured:boolean;sync:{ok:boolean;at:string}|null}>;},refetchInterval:30000});
 const items = [
 {label:"Outgoing mail",detail:"SMTP connection",ready:data?.smtpConfigured},
 {label:"Incoming mail",detail:"IMAP connection",ready:data?.imapConfigured},
 ];
 return <Card className="rounded-2xl border border-slate-200 bg-white p-6"><CardHeader className="pt-0"><CardTitle>Mail connections</CardTitle><p className="mt-1 text-sm text-slate-500">Connection status for your email provider.</p></CardHeader><CardContent><div className="grid gap-4 sm:grid-cols-2">{items.map(item=><div key={item.label} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{item.label}</h3><span className={`rounded-md px-2 py-1 text-[11px] font-medium ${item.ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{data ? item.ready ? "Configured" : "Not connected" : "Loading"}</span></div><p className="mt-2 text-xs text-slate-500">{item.detail}</p></div>)}</div><p className="mt-5 text-xs leading-6 text-slate-500">{!data?.imapConfigured ? "Add your email provider credentials to connect your inbox." : data.sync ? `Last sync: ${data.sync.ok ? "Successful" : "Needs attention"} · ${new Date(data.sync.at).toLocaleString()}` : "Waiting for the first mailbox sync."}</p></CardContent></Card>;
}

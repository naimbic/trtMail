import { redirect } from "next/navigation";
import { hasAdminAccount } from "@/lib/auth/setup";
import { getEnv } from "@/lib/cloudflare";
export const dynamic="force-dynamic";
export default async function SetupPage(){
 if(await hasAdminAccount(getEnv()))redirect('/login');
 return <main className="mx-auto max-w-xl p-12"><h1 className="text-2xl font-semibold">trtMail · Server setup</h1><p className="mt-6">Set ADMIN_EMAIL, ADMIN_PASSWORD and MAIL_ADDRESS in your Coolify application, then redeploy to initialize your private inbox.</p><p className="mt-4">Connect your existing email provider with SMTP_HOST and IMAP_HOST. No Cloudflare Worker or API token is required.</p></main>;
}

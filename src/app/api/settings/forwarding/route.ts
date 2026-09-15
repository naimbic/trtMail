import { requireUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
export async function PATCH(request:Request){await requireUser(getEnv(),request);return Response.json({error:"Configure forwarding at your email provider."},{status:409});}

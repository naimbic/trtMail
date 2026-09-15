import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/cookies";
import { assertAdmin } from "@/lib/auth/admin";
import { getEnv } from "@/lib/cloudflare";
export async function GET(request:Request){const user=await requireUser(getEnv(),request);assertAdmin(user);return NextResponse.json({enabled:false,message:"Deploy updates through your Coolify Git integration."});}
export async function POST(request:Request){const user=await requireUser(getEnv(),request);assertAdmin(user);return NextResponse.json({error:"Deploy updates through Coolify."},{status:409});}

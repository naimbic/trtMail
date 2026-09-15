import { NextResponse } from "next/server";
export async function POST(){return NextResponse.json({error:"Set MAIL_ADDRESS and MAIL_DOMAINS in Coolify."},{status:403});}

import { NextResponse } from "next/server";
export async function POST() {return NextResponse.json({error:"Create the initial administrator using ADMIN_EMAIL and ADMIN_PASSWORD in Coolify. Public registration is disabled."},{status:403});}

import { NextResponse } from "next/server";
export async function POST(){return NextResponse.json({error:"Server initialization is performed at container startup."},{status:403});}

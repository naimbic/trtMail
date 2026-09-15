import { getServerDatabase } from '@/lib/server/runtime';
export const dynamic='force-dynamic';
export async function GET(){try{getServerDatabase().sqlite.prepare('SELECT 1').get();return Response.json({ok:true});}catch{return Response.json({ok:false},{status:503});}}

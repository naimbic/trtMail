import { getServerDatabase } from '../../src/lib/server/runtime';
import { workerCycle } from '../../src/lib/server/jobs';
let stopped=false;
process.on('SIGTERM',()=>{stopped=true;});process.on('SIGINT',()=>{stopped=true;});
// Exactly one worker process per persistent volume. Recover interrupted jobs on restart.
getServerDatabase().sqlite.exec("UPDATE _cf_server_jobs SET status='queued' WHERE status='running'");
async function main(){while(!stopped){try{await workerCycle();}catch{console.error('Mail worker cycle failed.');}await new Promise(r=>setTimeout(r,Math.max(5000,Number(process.env.MAIL_POLL_INTERVAL_MS||30000))));}}
main().catch(()=>{process.exitCode=1;});

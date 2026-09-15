import { spawn } from 'node:child_process';
const init=spawn(process.execPath,['--import','tsx','scripts/server/init.ts'],{stdio:'inherit'});
init.on('exit',code=>{
 if(code!==0){process.exit(code||1);return;}
 const children=[spawn(process.execPath,['--import','tsx','scripts/server/worker.ts'],{stdio:'inherit'}),spawn(process.execPath,['server.js'],{stdio:'inherit'})];
 let stopping=false;
 function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');setTimeout(()=>{for(const child of children)child.kill('SIGKILL');process.exit(code);},10000).unref();}
 for(const child of children)child.on('exit',code=>stop(code||1));
 process.on('SIGTERM',()=>stop());process.on('SIGINT',()=>stop());
});

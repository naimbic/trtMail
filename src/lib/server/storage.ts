import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
export class FileBucket {
  constructor(private root:string) {}
  private path(key:string) { return join(this.root,createHash('sha256').update(key).digest('hex')); }
  async put(key:string,value:unknown,options?:{httpMetadata?:Record<string,string>;customMetadata?:Record<string,string>}) {
    const bytes=Buffer.from(await new Response(value as BodyInit).arrayBuffer());
    if(bytes.length>50*1024*1024) throw new Error('Object exceeds 50 MB');
    await mkdir(this.root,{recursive:true,mode:0o700});
    const file=this.path(key), temp=file+'.'+randomUUID();
    // Data and metadata are a single atomic file, so readers cannot see mismatched versions.
    const header=Buffer.from(JSON.stringify({key,...options,size:bytes.length})+'\n');
    await writeFile(temp,Buffer.concat([header,bytes]),{mode:0o600}); await rename(temp,file);
    return {key,size:bytes.length};
  }
  async get(key:string,options?:{range?:{offset?:number;length?:number}}) {
    let file:Buffer; try {file=await readFile(this.path(key));} catch(e) {if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
    const split=file.indexOf(10), metadata=JSON.parse(file.subarray(0,split).toString());
    let bytes=file.subarray(split+1); const size=bytes.length;
    if(options?.range) {const offset=options.range.offset??0; bytes=bytes.subarray(offset,options.range.length===undefined?undefined:offset+options.range.length);}
    return {key,size,httpMetadata:metadata.httpMetadata,customMetadata:metadata.customMetadata,
      body:new Response(new Uint8Array(bytes)).body!,arrayBuffer:async()=>new Uint8Array(bytes).buffer,
      text:async()=>bytes.toString(),json:async()=>JSON.parse(bytes.toString()),
      writeHttpMetadata:(headers:Headers)=>{if(metadata.httpMetadata?.contentType)headers.set('Content-Type',metadata.httpMetadata.contentType);}};
  }
  async delete(key:string|string[]) {for(const item of Array.isArray(key)?key:[key])await rm(this.path(item),{force:true});}
  async head(key:string) {return this.get(key);}
}

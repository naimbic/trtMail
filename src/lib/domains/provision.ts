import { externalMailDomain } from "@/lib/server/provision";
import type { DomainProvisioningResult } from "./types";
// Keep this exported name for existing call sites; no external DNS mutations occur.
export async function provisionDomainOnCloudflare(_env:CloudflareEnv,hostname:string,_options?:{enableRouting?:boolean;enableSending?:boolean}):Promise<DomainProvisioningResult>{return externalMailDomain(hostname);}

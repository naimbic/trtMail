import type { DomainProvisioningResult } from '../domains/types';
export function externalMailDomain(hostname:string):DomainProvisioningResult {
 const name=hostname.toLowerCase().trim();
 const allowed=(process.env.MAIL_DOMAINS||process.env.MAIL_ADDRESS?.split('@')[1]||'').split(',').map(s=>s.trim().toLowerCase());
 if(!allowed.includes(name))throw new Error('Add this domain to MAIL_DOMAINS in Coolify and configure it at your email provider first.');
 return {hostname:name,zone:{id:`smtp:${name}`,name},routingEnabled:Boolean(process.env.IMAP_HOST),sendingEnabled:Boolean(process.env.SMTP_HOST),sendingSubdomainTag:null,routingStatus:'managed-by-mail-provider'};
}

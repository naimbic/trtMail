// Compatibility name retained for existing application imports. Runtime is now Node.js.
import { getServerEnv } from './server/runtime';
export function getEnv():CloudflareEnv {return getServerEnv();}
export async function getEnvAsync():Promise<CloudflareEnv> {return getServerEnv();}

import type { SetupRequirementCheck } from "./types";
export function getSetupRequirementChecks(env:CloudflareEnv):SetupRequirementCheck[]{return [
 {key:"SQLite database",configured:!!env.DB,message:"Mount persistent storage at DATA_DIR."},
 {key:"Outgoing mail",configured:!!process.env.SMTP_HOST,message:"Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD."},
 {key:"Incoming mail",configured:!!process.env.IMAP_HOST,message:"Set IMAP_HOST, IMAP_USER and IMAP_PASSWORD."}
];}

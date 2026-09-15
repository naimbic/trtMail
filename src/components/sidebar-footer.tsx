import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import packageJson from "../../package.json";
import { useSidebar } from "./sidebar-state";
export function SidebarFooter() {
 const { minimal } = useSidebar();
 if (minimal) return <Link href="/releases" title="Version history" aria-label="Version history" className="mx-auto mt-4 rounded-lg px-1 py-2 text-[10px] text-slate-400">v{packageJson.version}</Link>;
 return <div className="mail-sidebar-footer"><Link href="/releases" className="flex items-center justify-between gap-2 text-xs text-slate-200"><span>trtDigital Mail <span className="text-slate-400">v{packageJson.version}</span></span><ArrowUpRight size={13}/></Link><a href="https://trtdigital.ma" target="_blank" rel="noreferrer" className="mt-2 block text-[11px] text-slate-400">By TRT Digital</a></div>;
}

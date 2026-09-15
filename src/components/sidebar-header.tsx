"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { BrandName } from "@/components/brand-name";
import { useBranding } from "./branding-provider";
import { useSidebar } from "./sidebar-state";
import type { SidebarHeaderProps } from "./sidebar-state-types";

export function SidebarHeader({ href, label }: SidebarHeaderProps) {
	const branding = useBranding();
	const { minimal, toggle } = useSidebar();
 return <div className="mail-sidebar-header"><Link href={href} className={minimal ? "sr-only" : "min-w-0"}><BrandName name={branding.appName}/></Link><button type="button" onClick={toggle} aria-label={minimal ? "Expand menu" : "Collapse menu"} className="mail-collapse"><Menu size={18}/></button></div>;
}

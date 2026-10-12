"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { isActiveSettingsPath, settingsNavSections } from "./settings-nav-utils";

export function SettingsNav() {
	const pathname = usePathname();
	const rowRef = useRef<HTMLDivElement>(null);

	// On phones the menu is one scrollable row; keep the active page in view.
	useEffect(() => {
		rowRef.current?.querySelector<HTMLElement>("[aria-current=page]")?.scrollIntoView({ inline: "center", block: "nearest" });
	}, [pathname]);

	return (
		<aside className="w-full border-b border-blue-100/70 px-4 py-4 md:min-h-full md:w-64 md:border-b-0 md:border-r md:py-10">
			<div ref={rowRef} className="max-md:-mx-4 max-md:flex max-md:gap-1 max-md:overflow-x-auto max-md:px-4 max-md:[scrollbar-width:none] space-y-4 md:sticky md:top-6 md:space-y-7">
				{settingsNavSections.map((section) => (
					<div key={section.label} className="space-y-3 max-md:contents">
						<h2 className="max-md:hidden px-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
							{section.label}
						</h2>
						<nav className="max-md:contents space-y-px">
							{section.items.map((item) => {
								const active = isActiveSettingsPath(pathname, item.href);
								return (
									<Link
										key={item.href}
										href={item.href}
										aria-current={active ? "page" : undefined}
										className={cn(
											"block rounded-full px-4 py-1.5 text-sm font-medium transition-colors max-md:shrink-0 max-md:whitespace-nowrap",
											active
												? "bg-blue-100 text-blue-900"
												: "text-neutral-600 hover:bg-white/70 hover:text-neutral-900",
										)}
									>
										{item.label}
									</Link>
								);
							})}
						</nav>
					</div>
				))}
			</div>
		</aside>
	);
}

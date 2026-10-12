"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useSidebar } from "@/components/sidebar-state";

function MobileMenuButton() {
	const { setMobileOpen } = useSidebar();
	return (
		<button
			type="button"
			onClick={() => setMobileOpen(true)}
			aria-label="Open menu"
			className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-200 md:hidden"
		>
			<Menu className="h-5 w-5" />
		</button>
	);
}

type AppShellProps = {
	/** Left menu content (becomes a slide-in drawer on phones). */
	nav: ReactNode;
	/** Content of the top bar (a menu button is added automatically on phones). */
	header: ReactNode;
	headerClassName?: string;
	mainClassName?: string;
	children: ReactNode;
	/** Floating UI rendered next to the shell (composer, toasts…). */
	extras?: ReactNode;
};

/** Shared responsive shell: sidebar column on desktop, off-canvas drawer on phones. */
export function AppShell({ nav, header, headerClassName = "", mainClassName = "", children, extras }: AppShellProps) {
	const { mobileOpen, setMobileOpen } = useSidebar();
	const pathname = usePathname();
	useEffect(() => setMobileOpen(false), [pathname, setMobileOpen]);

	return (
		<div className="mail-shell grid h-dvh grid-cols-1 overflow-hidden bg-[#f6f8fc] transition-[grid-template-columns] duration-200 md:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
			{mobileOpen && (
				<div className="fixed inset-0 z-40 bg-neutral-900/40 md:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
			)}
			<aside
				onClick={(event) => {
					if ((event.target as HTMLElement).closest("a,button")) setMobileOpen(false);
				}}
				className={`mail-sidebar min-h-0 overflow-y-auto overscroll-contain px-3 py-4 scrollbar-gutter-stable max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-[280px] max-md:max-w-[85vw] max-md:transition-transform max-md:duration-200 ${
					mobileOpen ? "max-md:translate-x-0 max-md:shadow-2xl" : "max-md:-translate-x-full max-md:shadow-none"
				}`}
			>
				{nav}
			</aside>
			<div className="flex min-h-0 min-w-0 flex-col">
				<header className={`mail-topbar flex h-16 w-full shrink-0 items-center gap-2 pr-4 text-sm md:gap-4 ${headerClassName}`}>
					<MobileMenuButton />
					{header}
				</header>
				<main
					className={`mail-content min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-white scrollbar-gutter-stable max-md:overflow-x-hidden md:rounded-tl-3xl ${mainClassName}`}
				>
					{children}
				</main>
			</div>
			{extras}
		</div>
	);
}

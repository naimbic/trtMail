import type { ReactNode } from "react";

export type SidebarState = {
	minimal: boolean;
	toggle(): void;
	/** Off-canvas drawer on phones. */
	mobileOpen: boolean;
	setMobileOpen(open: boolean): void;
};

export type SidebarProviderProps = {
	children: ReactNode;
	expandedWidth?: number;
};

export type SidebarHeaderProps = {
	href: string;
	label?: string;
};

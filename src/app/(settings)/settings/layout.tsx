import type { ReactNode } from "react";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: { children: ReactNode }) {
	return (
		<div className="flex min-h-[calc(100dvh-4rem)] flex-col-reverse gap-4 bg-inherit md:flex-row">
			<div className="min-w-0 flex-1 px-3 pt-4 md:px-0">
				<div className="mx-auto w-full max-w-3xl">{children}</div>
			</div>
			<SettingsNav />
		</div>
	);
}

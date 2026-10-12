import type { ReactNode } from "react";
import { AccountSettingsNav } from "@/components/accounts/account-settings-nav";

export default function AccountSettingsLayout({ children }: { children: ReactNode }) {
	return (
		<div className="flex flex-col-reverse gap-4 lg:min-h-[calc(100dvh-5rem)] lg:flex-row lg:gap-8">
			<div className="min-w-0 flex-1">{children}</div>
			<AccountSettingsNav />
		</div>
	);
}

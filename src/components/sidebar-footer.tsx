import Link from "next/link";
import packageJson from "../../package.json";
import { InstallAppButton } from "./install-app-button";
import { useSidebar } from "./sidebar-state";

export function SidebarFooter() {
	const { minimal } = useSidebar();
	return (
		<>
		<InstallAppButton />
		<Link
			href="/releases"
			title={`trtDigital v${packageJson.version} — version history`}
			aria-label="Version history"
			className="mail-sidebar-version"
		>
			{minimal ? `v${packageJson.version}` : <>trtDigital <span>v{packageJson.version}</span></>}
		</Link>
		</>
	);
}

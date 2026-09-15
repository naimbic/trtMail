import packageJson from "../../package.json";
import { useSidebar } from "./sidebar-state";

export function SidebarFooter() {
	const { minimal } = useSidebar();
	if (minimal) return null;
  return (
    <p className="px-3 pt-3 text-xs text-neutral-400">
      <span className="mb-1 block">trtMail · <a href="https://trtdigital.ma" target="_blank" rel="noreferrer">TRT Digital</a></span>
      Powered by{" "}
      <a href={`https://mailflare.co/?ref=${location.hostname}&v=${packageJson.version}`} target="_blank">
        Mailflare v{packageJson.version}
      </a>
    </p>
  );
}

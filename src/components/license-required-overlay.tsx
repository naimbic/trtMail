import { LockKeyhole } from "lucide-react";
import type { LicenseRequiredOverlayProps } from "./license-required-overlay-types";
export function LicenseRequiredOverlay(_: LicenseRequiredOverlayProps) {
 return <section className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center"><LockKeyhole className="mx-auto h-8 w-8 text-slate-400" /><h2 className="mt-5 text-lg font-semibold">Feature unavailable</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">This feature is not enabled for this installation. Contact your workspace administrator for assistance.</p></section>;
}

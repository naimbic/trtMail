// Per-viewer notification preferences (localStorage). Sound is ON by default;
// desktop (OS) notifications are OFF until the user opts in (needs permission).

export const SOUND_KEY = "trtmail:sound";
export const DESKTOP_KEY = "trtmail:desktop";

export function isSoundEnabled(): boolean {
	try {
		return localStorage.getItem(SOUND_KEY) !== "off";
	} catch {
		return true;
	}
}

export function setSoundEnabled(on: boolean): void {
	try {
		localStorage.setItem(SOUND_KEY, on ? "on" : "off");
	} catch {
		/* ignore */
	}
}

export function isDesktopEnabled(): boolean {
	try {
		return localStorage.getItem(DESKTOP_KEY) === "on";
	} catch {
		return false;
	}
}

export function setDesktopEnabled(on: boolean): void {
	try {
		localStorage.setItem(DESKTOP_KEY, on ? "on" : "off");
	} catch {
		/* ignore */
	}
}

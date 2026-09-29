// Per-viewer notification preferences (localStorage). Sound is ON by default;
// desktop (OS) notifications are OFF until the user opts in (needs permission).

export const SOUND_KEY = "trtmail:sound";
export const DESKTOP_KEY = "trtmail:desktop";
export const UNDO_SEND_KEY = "trtmail:undosend";

/** Undo-send window in seconds (0 = send immediately). Default 5. */
export function getUndoSendSeconds(): number {
	try {
		const n = Number(localStorage.getItem(UNDO_SEND_KEY));
		return Number.isFinite(n) && n >= 0 ? n : 5;
	} catch {
		return 5;
	}
}

export function setUndoSendSeconds(secs: number): void {
	try {
		localStorage.setItem(UNDO_SEND_KEY, String(secs));
	} catch {
		/* ignore */
	}
}

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

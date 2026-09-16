"use client";

import { useEffect, useRef } from "react";
import { Bold, Italic, Underline, List, Link2 } from "lucide-react";

/**
 * Minimal dependency-free rich-text editor (contentEditable + execCommand).
 * Emits HTML and a derived plaintext. Uncontrolled: `seed` sets the initial/refreshed
 * content (e.g. signature or a loaded draft) without fighting the caret on each keystroke.
 */
export function RichEditor({
	seed,
	disabled,
	onChange,
	className,
}: {
	seed: string;
	disabled?: boolean;
	onChange: (html: string, text: string) => void;
	className?: string;
}) {
	const ref = useRef<HTMLDivElement | null>(null);

	// Seed content from external changes (mount, draft load, signature) — but never
	// while the user is typing in it, so the caret is preserved.
	useEffect(() => {
		const el = ref.current;
		if (!el || document.activeElement === el) return;
		// Compare plaintext: if the seed says the same words as what's shown, keep the
		// user's rich formatting; only overwrite when the underlying text truly changed.
		const tmp = document.createElement("div");
		tmp.innerHTML = seed || "";
		if (tmp.innerText.trim() === el.innerText.trim()) return;
		el.innerHTML = seed || "";
		onChange(el.innerHTML, el.innerText);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [seed]);

	function emit() {
		const el = ref.current;
		if (el) onChange(el.innerHTML, el.innerText);
	}

	function exec(command: string, value?: string) {
		document.execCommand(command, false, value);
		ref.current?.focus();
		emit();
	}

	const btn = "rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-40";

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex items-center gap-0.5 border-b border-neutral-100 pb-2">
				<button type="button" title="Bold" className={btn} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}>
					<Bold className="h-4 w-4" />
				</button>
				<button type="button" title="Italic" className={btn} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}>
					<Italic className="h-4 w-4" />
				</button>
				<button type="button" title="Underline" className={btn} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")}>
					<Underline className="h-4 w-4" />
				</button>
				<button type="button" title="Bulleted list" className={btn} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")}>
					<List className="h-4 w-4" />
				</button>
				<button
					type="button"
					title="Insert link"
					className={btn}
					disabled={disabled}
					onMouseDown={(e) => e.preventDefault()}
					onClick={() => {
						const url = window.prompt("Link URL");
						if (url) exec("createLink", url);
					}}
				>
					<Link2 className="h-4 w-4" />
				</button>
			</div>
			<div
				ref={ref}
				contentEditable={!disabled}
				suppressContentEditableWarning
				onInput={emit}
				role="textbox"
				aria-multiline="true"
				className={`prose prose-sm mt-2 h-full max-w-none flex-1 overflow-auto text-sm text-neutral-900 focus:outline-none ${className ?? ""}`}
			/>
		</div>
	);
}

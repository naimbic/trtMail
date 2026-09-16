"use client";

import { useEffect, useRef, useState } from "react";
import {
	Bold,
	Italic,
	Underline,
	Strikethrough,
	List,
	ListOrdered,
	Link2,
	Quote,
	Code,
	Heading1,
	Heading2,
	AlignLeft,
	AlignCenter,
	AlignRight,
	RemoveFormatting,
	Highlighter,
	Baseline,
} from "lucide-react";

/**
 * Rich-text email editor (contentEditable + execCommand) — dependency-free.
 * Emits HTML and a derived plaintext. Uncontrolled: `seed` sets initial/refreshed
 * content (signature, loaded draft) without fighting the caret while typing.
 */

const TEXT_COLORS = ["#111827", "#dc2626", "#ea580c", "#16a34a", "#2563eb", "#7c3aed", "#db2777", "#6b7280"];
const HIGHLIGHTS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#e9d5ff", "transparent"];

export function RichEditor({
	seed,
	disabled,
	onChange,
	className,
	placeholder = "Write your message…",
}: {
	seed: string;
	disabled?: boolean;
	onChange: (html: string, text: string) => void;
	className?: string;
	placeholder?: string;
}) {
	const ref = useRef<HTMLDivElement | null>(null);
	const [colorOpen, setColorOpen] = useState<"text" | "mark" | null>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el || document.activeElement === el) return;
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
		ref.current?.focus();
		document.execCommand(command, false, value);
		emit();
	}

	function toggleBlock(tag: string) {
		// If already this block, toggle back to paragraph.
		const current = document.queryCommandValue("formatBlock").toLowerCase();
		exec("formatBlock", current === tag || current === `<${tag}>` ? "P" : tag);
	}

	const btn =
		"flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-40";
	const Divider = () => <span className="mx-0.5 h-5 w-px bg-neutral-200" />;
	const noBlur = (e: React.MouseEvent) => e.preventDefault();

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-100 pb-2">
				<button type="button" title="Heading 1" className={btn} disabled={disabled} onMouseDown={noBlur} onClick={() => toggleBlock("h1")}><Heading1 className="h-4 w-4" /></button>
				<button type="button" title="Heading 2" className={btn} disabled={disabled} onMouseDown={noBlur} onClick={() => toggleBlock("h2")}><Heading2 className="h-4 w-4" /></button>
				<Divider />
				<button type="button" title="Bold" className={btn} disabled={disabled} onMouseDown={noBlur} onClick={() => exec("bold")}><Bold className="h-4 w-4" /></button>
				<button type="button" title="Italic" className={btn} disabled={disabled} onMouseDown={noBlur} onClick={() => exec("italic")}><Italic className="h-4 w-4" /></button>
				<button type="button" title="Underline" className={btn} disabled={disabled} onMouseDown={noBlur} onClick={() => exec("underline")}><Underline className="h-4 w-4" /></button>
				<button type="button" title="Strikethrough" className={btn} disabled={disabled} onMouseDown={noBlur} onClick={() => exec("strikeThrough")}><Strikethrough className="h-4 w-4" /></button>
				<Divider />
				<div className="relative">
					<button type="button" title="Text color" className={btn} disabled={disabled} onMouseDown={noBlur} onClick={() => setColorOpen(colorOpen === "text" ? null : "text")}><Baseline className="h-4 w-4" /></button>
					{colorOpen === "text" && (
						<div className="absolute left-0 top-9 z-20 flex gap-1 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg" onMouseDown={noBlur}>
							{TEXT_COLORS.map((c) => (
								<button key={c} type="button" className="h-5 w-5 rounded-full border border-neutral-200" style={{ background: c }} onClick={() => { exec("foreColor", c); setColorOpen(null); }} />
							))}
						</div>
					)}
				</div>
				<div className="relative">
					<button type="button" title="Highlight" className={btn} disabled={disabled} onMouseDown={noBlur} onClick={() => setColorOpen(colorOpen === "mark" ? null : "mark")}><Highlighter className="h-4 w-4" /></button>
					{colorOpen === "mark" && (
						<div className="absolute left-0 top-9 z-20 flex gap-1 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg" onMouseDown={noBlur}>
							{HIGHLIGHTS.map((c) => (
								<button key={c} type="button" className="h-5 w-5 rounded-full border border-neutral-200" style={{ background: c === "transparent" ? "#fff" : c }} onClick={() => { exec("hiliteColor", c); setColorOpen(null); }} />
							))}
						</div>
					)}
				</div>
				<Divider />
				<button type="button" title="Bulleted list" className={btn} disabled={disabled} onMouseDown={noBlur} onClick={() => exec("insertUnorderedList")}><List className="h-4 w-4" /></button>
				<button type="button" title="Numbered list" className={btn} disabled={disabled} onMouseDown={noBlur} onClick={() => exec("insertOrderedList")}><ListOrdered className="h-4 w-4" /></button>
				<button type="button" title="Quote" className={btn} disabled={disabled} onMouseDown={noBlur} onClick={() => toggleBlock("blockquote")}><Quote className="h-4 w-4" /></button>
				<button type="button" title="Code block" className={btn} disabled={disabled} onMouseDown={noBlur} onClick={() => toggleBlock("pre")}><Code className="h-4 w-4" /></button>
				<Divider />
				<button type="button" title="Align left" className={btn} disabled={disabled} onMouseDown={noBlur} onClick={() => exec("justifyLeft")}><AlignLeft className="h-4 w-4" /></button>
				<button type="button" title="Align center" className={btn} disabled={disabled} onMouseDown={noBlur} onClick={() => exec("justifyCenter")}><AlignCenter className="h-4 w-4" /></button>
				<button type="button" title="Align right" className={btn} disabled={disabled} onMouseDown={noBlur} onClick={() => exec("justifyRight")}><AlignRight className="h-4 w-4" /></button>
				<Divider />
				<button type="button" title="Insert link" className={btn} disabled={disabled} onMouseDown={noBlur} onClick={() => { const url = window.prompt("Link URL"); if (url) exec("createLink", url); }}><Link2 className="h-4 w-4" /></button>
				<button type="button" title="Clear formatting" className={btn} disabled={disabled} onMouseDown={noBlur} onClick={() => { exec("removeFormat"); exec("formatBlock", "P"); }}><RemoveFormatting className="h-4 w-4" /></button>
			</div>
			<div
				ref={ref}
				contentEditable={!disabled}
				suppressContentEditableWarning
				onInput={emit}
				onBlur={() => setColorOpen(null)}
				role="textbox"
				aria-multiline="true"
				data-placeholder={placeholder}
				className={`rich-editor prose prose-sm mt-3 h-full max-w-none flex-1 overflow-auto text-sm text-neutral-900 focus:outline-none ${className ?? ""}`}
			/>
			<style jsx global>{`
				.rich-editor:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; }
				.rich-editor blockquote { border-left: 3px solid #e5e7eb; margin: 0.5em 0; padding-left: 12px; color: #4b5563; }
				.rich-editor pre { background: #f3f4f6; border-radius: 8px; padding: 10px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; overflow-x: auto; }
				.rich-editor a { color: #2563eb; text-decoration: underline; }
				.rich-editor h1 { font-size: 1.4em; font-weight: 700; margin: 0.4em 0; }
				.rich-editor h2 { font-size: 1.2em; font-weight: 700; margin: 0.4em 0; }
				.rich-editor ul { list-style: disc; padding-left: 1.4em; }
				.rich-editor ol { list-style: decimal; padding-left: 1.4em; }
			`}</style>
		</div>
	);
}

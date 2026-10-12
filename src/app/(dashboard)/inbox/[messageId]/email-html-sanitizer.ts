const ALLOWED_TAGS = new Set([
	"a",
	"abbr",
	"address",
	"b",
	"blockquote",
	"br",
	"caption",
	"code",
	"col",
	"colgroup",
	"dd",
	"del",
	"div",
	"dl",
	"dt",
	"em",
	"figcaption",
	"figure",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"hr",
	"i",
	"img",
	"ins",
	"kbd",
	"li",
	"ol",
	"p",
	"pre",
	"q",
	"s",
	"samp",
	"small",
	"span",
	"strong",
	"sub",
	"sup",
	"table",
	"tbody",
	"td",
	"tfoot",
	"th",
	"thead",
	"tr",
	"u",
	"ul",
]);

const DROP_CONTENT_TAGS = new Set([
	"base",
	"button",
	"embed",
	"form",
	"iframe",
	"input",
	"link",
	"math",
	"meta",
	"object",
	"option",
	"script",
	"select",
	"style",
	"svg",
	"textarea",
]);

const GLOBAL_ATTRIBUTES = new Set(["dir", "lang", "style", "title"]);
const TAG_ATTRIBUTES: Record<string, Set<string>> = {
	a: new Set(["href"]),
	blockquote: new Set(["cite"]),
	col: new Set(["span", "width"]),
	img: new Set(["alt", "height", "src", "width"]),
	li: new Set(["value"]),
	ol: new Set(["start", "type"]),
	table: new Set(["border", "cellpadding", "cellspacing", "width"]),
	td: new Set(["align", "colspan", "rowspan", "valign", "width"]),
	th: new Set(["align", "colspan", "rowspan", "scope", "valign", "width"]),
};

const ALLOWED_STYLE_PROPERTIES = new Set([
	"background",
	"background-color",
	"background-image",
	"box-shadow",
	"border",
	"border-bottom",
	"border-color",
	"border-left",
	"border-radius",
	"border-right",
	"border-style",
	"border-top",
	"border-width",
	"color",
	"display",
	"font-family",
	"font-size",
	"font-style",
	"font-weight",
	"height",
	"letter-spacing",
	"line-height",
	"margin",
	"margin-bottom",
	"margin-left",
	"margin-right",
	"margin-top",
	"max-width",
	"min-width",
	"padding",
	"padding-bottom",
	"padding-left",
	"padding-right",
	"padding-top",
	"text-align",
	"text-decoration",
	"text-indent",
	"text-transform",
	"vertical-align",
	"white-space",
	"width",
	"word-break",
	"word-wrap",
]);
const APP_FONT_FALLBACK = "var(--font-geist-sans), system-ui, sans-serif";

function isSafeLinkUrl(value: string): boolean {
	try {
		const url = new URL(value, window.location.origin);
		return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
	} catch {
		return false;
	}
}

function isSafeImageUrl(value: string): boolean {
	if (value.startsWith("/api/messages/")) return true;
	if (/^data:image\/(?:gif|jpeg|png|webp);base64,/i.test(value)) return true;
	try {
		const url = new URL(value, window.location.origin);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

function sanitizeStyle(element: HTMLElement): void {
	const safeDeclarations: string[] = [];
	for (const property of Array.from(element.style)) {
		if (!ALLOWED_STYLE_PROPERTIES.has(property)) continue;
		const value = element.style.getPropertyValue(property);
		if (/url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:|-moz-binding/i.test(value)) continue;
		// "white-space: pre*" on a container turns every newline in the email's HTML source into a visible blank line.
		if (property === "white-space" && /^pre/i.test(value.trim()) && element.children.length > 0) continue;
		const safeValue = property === "font-family"
			? `${value}, ${APP_FONT_FALLBACK}`
			: value;
		safeDeclarations.push(`${property}: ${safeValue}`);
	}
	if (safeDeclarations.length) {
		element.setAttribute("style", safeDeclarations.join("; "));
	} else {
		element.removeAttribute("style");
	}
}

function sanitizeElement(element: Element): void {
	const tag = element.tagName.toLowerCase();
	if (!ALLOWED_TAGS.has(tag)) {
		if (DROP_CONTENT_TAGS.has(tag)) {
			element.remove();
			return;
		}
		element.replaceWith(...Array.from(element.childNodes));
		return;
	}

	for (const attribute of Array.from(element.attributes)) {
		const name = attribute.name.toLowerCase();
		const allowed = GLOBAL_ATTRIBUTES.has(name) || TAG_ATTRIBUTES[tag]?.has(name);
		if (!allowed || name.startsWith("on")) element.removeAttribute(attribute.name);
	}

	if (element instanceof HTMLElement) sanitizeStyle(element);

	if (tag === "a") {
		const href = element.getAttribute("href");
		if (!href || !isSafeLinkUrl(href)) {
			element.removeAttribute("href");
		} else {
			element.setAttribute("target", "_blank");
			element.setAttribute("rel", "noopener noreferrer");
		}
	}

	if (tag === "img") {
		const src = element.getAttribute("src");
		if (!src || !isSafeImageUrl(src)) {
			element.remove();
			return;
		}
		element.setAttribute("loading", "lazy");
		element.setAttribute("referrerpolicy", "no-referrer");
	}
}

const BLANK_CHARS = /[\s\u00a0\u200b\u200c\u200d\ufeff]/g;

function isBlankBlock(element: Element): boolean {
	if (!["P", "DIV", "SPAN", "FONT", "H1", "H2", "H3", "H4", "H5", "H6"].includes(element.tagName)) return false;
	if (element.querySelector("img, hr, table, a, ul, ol, pre, blockquote")) return false;
	return (element.textContent ?? "").replace(BLANK_CHARS, "") === "";
}

function previousSignificantNode(node: Node): Node | null {
	let current = node.previousSibling;
	while (current && current.nodeType === Node.TEXT_NODE && (current.textContent ?? "").replace(BLANK_CHARS, "") === "") {
		current = current.previousSibling;
	}
	return current;
}

function tidyBlankSpace(root: Element): void {
	// 1. Runs of <br> keep at most one blank line.
	for (const br of Array.from(root.querySelectorAll("br"))) {
		if (!br.isConnected) continue;
		const prev1 = previousSignificantNode(br);
		const prev2 = prev1 && prev1.nodeName === "BR" ? previousSignificantNode(prev1) : null;
		if (prev1?.nodeName === "BR" && prev2?.nodeName === "BR") br.remove();
	}
	// 2. Runs of empty blocks collapse to a single one.
	for (const block of Array.from(root.querySelectorAll("p, div, span, font, h1, h2, h3, h4, h5, h6"))) {
		if (!block.isConnected || !isBlankBlock(block)) continue;
		const prev = previousSignificantNode(block);
		if (prev && prev.nodeType === Node.ELEMENT_NODE && isBlankBlock(prev as Element)) block.remove();
	}
	// 3. No blank blocks / <br>s at the very start or end of any container.
	for (const container of [root, ...Array.from(root.querySelectorAll("div, td, blockquote"))]) {
		if (container !== root && isBlankBlock(container)) continue; // a lone spacer keeps its <br>
		const isEdgeBlank = (el: Element | null) => !!el && (el.tagName === "BR" || isBlankBlock(el));
		let first = container.firstElementChild;
		while (isEdgeBlank(first) && !(first && previousSignificantNode(first))) {
			first!.remove();
			first = container.firstElementChild;
		}
		let last = container.lastElementChild;
		while (isEdgeBlank(last) && !((last?.nextSibling?.textContent ?? "").replace(BLANK_CHARS, ""))) {
			last!.remove();
			last = container.lastElementChild;
		}
	}
}

export function sanitizeEmailHtml(html: string | null): string | null {
	if (!html) return null;
	const document = new DOMParser().parseFromString(html, "text/html");
	for (const element of Array.from(document.body.querySelectorAll("*"))) {
		sanitizeElement(element);
	}
	tidyBlankSpace(document.body);
	return document.body.innerHTML;
}

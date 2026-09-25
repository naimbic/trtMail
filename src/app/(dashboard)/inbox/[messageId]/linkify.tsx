import type { ReactNode } from "react";

// URLs (http/https or bare www.) and email addresses. Trailing punctuation is
// left out of the match so "see http://x.com." doesn't swallow the period.
const PATTERN = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)"']|[^\s<@]+@[^\s<@]+\.[^\s<@.,;:!?)"']+)/g;

/** Turn plain-text URLs / emails into clickable links, keeping surrounding text. */
export function linkify(text: string | null | undefined): ReactNode[] {
	if (!text) return [];
	const nodes: ReactNode[] = [];
	let lastIndex = 0;
	let key = 0;
	let match: RegExpExecArray | null;
	PATTERN.lastIndex = 0;
	while ((match = PATTERN.exec(text)) !== null) {
		const token = match[0];
		if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
		const isEmail = token.includes("@") && !/^https?:\/\//i.test(token) && !/^www\./i.test(token);
		const href = isEmail
			? `mailto:${token}`
			: /^https?:\/\//i.test(token)
				? token
				: `https://${token}`;
		nodes.push(
			<a
				key={key++}
				href={href}
				target="_blank"
				rel="noreferrer noopener"
				className="text-blue-600 underline break-all"
			>
				{token}
			</a>,
		);
		lastIndex = match.index + token.length;
	}
	if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
	return nodes;
}

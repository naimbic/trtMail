/** Normalises plain-text email bodies: no stray blank-line runs, no accidental double spacing. */
export function tidyPlainText(text: string | null | undefined): string {
	if (!text) return "";
	const lines = text
		.replace(/\r\n?/g, "\n")
		.replace(/[​‌‍﻿]/g, "")
		.split("\n")
		.map((line) => line.replace(/[ \t ]+$/g, ""));

	// Some senders put a blank line after every line of text; collapse those.
	const filled = lines.filter((line) => line.trim() !== "");
	let doubleSpaced = false;
	if (filled.length >= 8) {
		let followedByBlank = 0;
		let consecutiveBlanks = 0;
		for (let i = 0; i < lines.length; i += 1) {
			if (lines[i].trim() === "") {
				if (lines[i - 1]?.trim() === "") consecutiveBlanks += 1;
			} else if (lines[i + 1] !== undefined && lines[i + 1].trim() === "") {
				followedByBlank += 1;
			}
		}
		const averageLength = filled.reduce((sum, line) => sum + line.length, 0) / filled.length;
		doubleSpaced = consecutiveBlanks === 0 && followedByBlank >= (filled.length - 1) * 0.9 && averageLength < 90;
	}

	const out: string[] = [];
	let blanks = 0;
	for (const line of lines) {
		if (line.trim() === "") {
			blanks += 1;
			if (doubleSpaced || blanks > 1 || out.length === 0) continue;
		} else {
			blanks = 0;
		}
		out.push(line);
	}
	while (out.length && out[out.length - 1].trim() === "") out.pop();
	return out.join("\n");
}

"use client";

import { useState, type KeyboardEvent } from "react";
import CreatableSelect from "react-select/creatable";
import type { MultiValue, StylesConfig } from "react-select";

/**
 * Chip-style recipient input (To / Cc / Bcc), à la trtApp's mail composer.
 * Type an address and press Enter, Tab or comma to turn it into a removable tag;
 * matching saved contacts appear in a dropdown as you type. Serializes to / from
 * the comma-separated string the send + draft APIs expect.
 */

export type RecipientOption = { label: string; value: string };

const toOption = (address: string): RecipientOption => ({ label: address, value: address });

const parseList = (value: string): RecipientOption[] =>
	value
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean)
		.map(toOption);

const styles: StylesConfig<RecipientOption, true> = {
	container: (base) => ({ ...base, flex: 1 }),
	control: (base) => ({
		...base,
		minHeight: 32,
		border: "none",
		boxShadow: "none",
		backgroundColor: "transparent",
		cursor: "text",
	}),
	valueContainer: (base) => ({ ...base, padding: 0, gap: 4 }),
	input: (base) => ({ ...base, margin: 0, padding: 0, fontSize: 14 }),
	placeholder: (base) => ({ ...base, margin: 0, color: "#9ca3af", fontSize: 14 }),
	multiValue: (base) => ({ ...base, backgroundColor: "#f3f4f6", borderRadius: 9999, padding: "0 2px 0 6px" }),
	multiValueLabel: (base) => ({ ...base, fontSize: 13, color: "#111827" }),
	multiValueRemove: (base) => ({
		...base,
		borderRadius: 9999,
		color: "#6b7280",
		":hover": { backgroundColor: "#e5e7eb", color: "#111827" },
	}),
	menu: (base) => ({ ...base, fontSize: 13, zIndex: 50 }),
	clearIndicator: (base) => ({ ...base, padding: 4, cursor: "pointer" }),
};

export function RecipientSelect({
	id,
	value,
	onChange,
	placeholder,
	disabled,
	suggestions = [],
}: {
	id?: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	suggestions?: RecipientOption[];
}) {
	const [inputValue, setInputValue] = useState("");
	const options = parseList(value);
	const selected = new Set(options.map((o) => o.value.toLowerCase()));

	const term = inputValue.trim().toLowerCase();
	const filtered = term
		? suggestions
				.filter((s) => !selected.has(s.value.toLowerCase()))
				.filter((s) => s.label.toLowerCase().includes(term) || s.value.toLowerCase().includes(term))
				.slice(0, 8)
		: [];
	const menuIsOpen = filtered.length > 0;

	function commit(next: RecipientOption[]) {
		const seen = new Set<string>();
		const unique = next.filter((o) => {
			const key = o.value.toLowerCase();
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
		onChange(unique.map((o) => o.value).join(", "));
	}

	function addFromInput() {
		const entry = inputValue.trim().replace(/,$/, "").trim();
		if (!entry) return;
		commit([...options, toOption(entry)]);
		setInputValue("");
	}

	function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (!inputValue) return;
		if (event.key === ",") {
			event.preventDefault();
			addFromInput();
			return;
		}
		// When the suggestions menu is open, let react-select handle Enter/Tab
		// (select a contact or the "Create …" option); otherwise add the raw input.
		if ((event.key === "Enter" || event.key === "Tab") && !menuIsOpen) {
			event.preventDefault();
			addFromInput();
		}
	}

	return (
		<CreatableSelect
			inputId={id}
			isMulti
			isDisabled={disabled}
			components={{ DropdownIndicator: null }}
			options={filtered}
			menuIsOpen={menuIsOpen}
			placeholder={placeholder}
			value={options}
			inputValue={inputValue}
			onInputChange={(next) => setInputValue(next)}
			onKeyDown={handleKeyDown}
			onBlur={addFromInput}
			onChange={(next: MultiValue<RecipientOption>) => {
				commit([...next]);
				setInputValue("");
			}}
			formatCreateLabel={(input) => `Add "${input}"`}
			styles={styles}
			classNamePrefix="recipient-select"
			aria-label={placeholder}
		/>
	);
}

"use client";

import { useState, type KeyboardEvent } from "react";
import CreatableSelect from "react-select/creatable";
import type { MultiValue, StylesConfig } from "react-select";

/**
 * Chip-style recipient input (To / Cc / Bcc), à la trtApp's mail composer.
 * Type an address and press Enter, Tab or comma to turn it into a removable tag.
 * Serializes to / from the comma-separated string the send + draft APIs expect,
 * so nothing downstream changes.
 */

type Option = { label: string; value: string };

const toOption = (address: string): Option => ({ label: address, value: address });

const parseList = (value: string): Option[] =>
	value
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean)
		.map(toOption);

// Borderless, transparent styling so it sits inside the composer's row like the
// other fields; chips are light neutral pills.
const styles: StylesConfig<Option, true> = {
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
	multiValue: (base) => ({
		...base,
		backgroundColor: "#f3f4f6",
		borderRadius: 9999,
		padding: "0 2px 0 6px",
	}),
	multiValueLabel: (base) => ({ ...base, fontSize: 13, color: "#111827" }),
	multiValueRemove: (base) => ({
		...base,
		borderRadius: 9999,
		color: "#6b7280",
		":hover": { backgroundColor: "#e5e7eb", color: "#111827" },
	}),
	clearIndicator: (base) => ({ ...base, padding: 4, cursor: "pointer" }),
};

export function RecipientSelect({
	id,
	value,
	onChange,
	placeholder,
	disabled,
	autoFocus,
}: {
	id?: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	autoFocus?: boolean;
}) {
	const [inputValue, setInputValue] = useState("");
	const options = parseList(value);

	function commit(next: Option[]) {
		// De-dupe by lowercased address, keep original casing/label of first seen.
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
		if (event.key === "Enter" || event.key === "Tab" || event.key === ",") {
			event.preventDefault();
			addFromInput();
		}
	}

	return (
		<CreatableSelect
			inputId={id}
			isMulti
			isDisabled={disabled}
			autoFocus={autoFocus}
			components={{ DropdownIndicator: null }}
			menuIsOpen={false}
			placeholder={placeholder}
			value={options}
			inputValue={inputValue}
			onInputChange={(next) => setInputValue(next)}
			onKeyDown={handleKeyDown}
			onBlur={addFromInput}
			onChange={(next: MultiValue<Option>) => commit([...next])}
			styles={styles}
			classNamePrefix="recipient-select"
			aria-label={placeholder}
		/>
	);
}

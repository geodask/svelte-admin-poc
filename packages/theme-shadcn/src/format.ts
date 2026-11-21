// How the Theme writes a Field's value as text. Every format uses a fixed `en` locale, and
// dates use UTC, so the server and the browser produce the same text and hydration matches.
import type { Field, FilterOperator, FilterValue } from '@svelte-admin/core';
import type { FilterChip } from '@svelte-admin/core/views';

/** How many items of a list a list View cell shows before "+N". */
export const CELL_ITEMS_SHOWN = 3;

const numberFormat = new Intl.NumberFormat('en');
const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });

export function formatNumber(value: number): string {
	return numberFormat.format(value);
}

export function formatBoolean(value: boolean): string {
	return value ? 'Yes' : 'No';
}

/** A `Date`, or a string or timestamp a `Date` can read. `undefined` when it isn't a date. */
export function formatDate(value: unknown): string | undefined {
	const date =
		value instanceof Date
			? value
			: typeof value === 'string' || typeof value === 'number'
				? new Date(value)
				: undefined;
	return date && !Number.isNaN(date.getTime()) ? dateFormat.format(date) : undefined;
}

/** One item of a list, or any scalar, by its runtime type. */
export function formatScalar(value: unknown): string {
	if (typeof value === 'number') return formatNumber(value);
	if (typeof value === 'boolean') return formatBoolean(value);
	if (value instanceof Date) return formatDate(value) ?? '';
	return value === null || value === undefined ? '' : String(value);
}

/** A value with no Kind to show it by: as is when it is a scalar, otherwise as JSON. */
export function formatUnknown(value: unknown): string {
	if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
		return JSON.stringify(value);
	}
	return formatScalar(value);
}

/** How a chip joins a Field's label to its values, by operator: "Name contains piz", "Prep time (min) ≥ 10". */
const OPERATOR_TEXT: Record<FilterOperator, string> = {
	eq: ': ',
	in: ': ',
	contains: ' contains ',
	lt: ' < ',
	lte: ' ≤ ',
	gt: ' > ',
	gte: ' ≥ '
};

/**
 * An active filter chip's text, from its parts: the Field's label, the operator, and each value
 * (joined by commas for `in`), as in "Prep time (min) ≥ 10" or "Difficulty: Easy, Medium". A
 * Reference's value is its record's Record title, as in "Author: Ada Lovelace", else its id.
 */
export function formatFilterChip(chip: FilterChip): string {
	const values = chip.values.map(
		({ value, title }) => title ?? formatFilterValue(chip.field, value)
	);
	return `${chip.field.label}${OPERATOR_TEXT[chip.operator]}${values.join(', ')}`;
}

/**
 * A filter value as the cells show it: a Reference's id as written (`1234`, never `1,234`), Yes or
 * No, a number with the `en` grouping, a date as the list shows it, and text and enum members as
 * they are. A datetime adds its time in UTC unless it is midnight, as the filter input writes it:
 * `HH:mm`, with seconds (and milliseconds) only when they aren't zero.
 */
function formatFilterValue(field: Field, value: FilterValue): string {
	if (field.kind === 'reference') return String(value);
	if (field.kind !== 'date' || typeof value === 'boolean') return formatScalar(value);
	const day = formatDate(value);
	if (day === undefined) return String(value);
	if (field.dateType !== 'datetime') return day;
	const time = new Date(value)
		.toISOString()
		.slice(11, 23)
		.replace(/\.000$/, '')
		.replace(/:00$/, '');
	return time === '00:00' ? day : `${day}, ${time} UTC`;
}

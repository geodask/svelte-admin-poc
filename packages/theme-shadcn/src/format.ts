// How the Theme writes a Field's value as text. Every format uses a fixed `en` locale, and
// dates use UTC, so the server and the browser produce the same text and hydration matches.

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

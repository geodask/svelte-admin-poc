// The CSV writer behind a list View's export. Pure, with no browser or Kit import, but meant for
// the server only: `serveResource`'s `exportList` runs it, and it must never reach the client
// build (the demo's client bundle check looks for it). Seeded from the proof of concept's
// `export.ts`, with a formula-injection guard added.
import type { Resource } from './resource.ts';

/** Starts the file, so a spreadsheet reads it as UTF-8 and shows accented text correctly. */
const BYTE_ORDER_MARK = '\uFEFF';

/** Ends every row, the header included (RFC 4180). */
const ROW_END = '\r\n';

/**
 * What a text cell may not start with, or a spreadsheet would run it as a formula (or, for a tab
 * or a carriage return, may drop the character and run what follows). The client bundle check
 * looks for this pattern's source, so keep it a literal.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * A Resource's records as a CSV file: one column per Field the detail View shows (every Field
 * that isn't hidden), in schema order, headed by the Field's label, and one row per record.
 *
 * - Text as it is; numbers as plain decimals (`1250`, `-5`, `45.5`, never with an exponent); booleans `true` and `false`; a
 *   `Date` as an ISO string, and an ISO date or datetime string as it is; a list of scalars
 *   joined with `, `; an object, or a list holding one, as JSON; a missing (or `null`) value as
 *   an empty cell.
 * - Every cell is quoted, with any `"` in it doubled, and every row ends with CRLF (RFC 4180).
 *   The file starts with a UTF-8 byte order mark.
 * - **Formula guard.** A cell that isn't a number and starts with `=`, `+`, `-`, `@`, a tab or a
 *   carriage return gets a `'` in front, so a spreadsheet shows it as text instead of running it.
 *   The headers are guarded too. A number is never prefixed, so `-5` stays a number.
 */
export function toCsv(
	resource: Pick<Resource, 'fields'>,
	records: readonly Record<string, unknown>[]
): string {
	const fields = resource.fields.filter((field) => field.detail);
	const rows = [
		fields.map((field) => guarded(field.label)),
		...records.map((record) => fields.map((field) => cell(record[field.key])))
	];
	return BYTE_ORDER_MARK + rows.map((row) => row.map(quoted).join(',') + ROW_END).join('');
}

/** One value as the text of its cell, guarded unless it is a number. */
function cell(value: unknown): string {
	if (typeof value === 'number') return plainDecimal(value);
	return guarded(text(value));
}

/**
 * A number as a plain decimal, as a spreadsheet reads it: `String` writes one, except for numbers
 * from 1e21 up and below 1e-6, which it writes with an exponent (`1e+21`, `1e-7`). Those are
 * spelled out (`1000000000000000000000`, `0.0000001`).
 */
function plainDecimal(value: number): string {
	const written = String(value);
	const exponential = /^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(written);
	if (exponential === null) return written;
	const [, sign, whole, fraction = '', exponent] = exponential;
	const digits = whole + fraction;
	const shift = Number(exponent);
	// From 1e21 up, the digits never reach past the decimal point: 21 places outnumber them.
	return shift > 0
		? sign + digits.padEnd(shift + 1, '0')
		: `${sign}0.${'0'.repeat(-shift - 1)}${digits}`;
}

/** One value as text: see `toCsv`. */
function text(value: unknown): string {
	if (value === undefined || value === null) return '';
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) {
		return value.every(isScalar) ? value.map(text).join(', ') : JSON.stringify(value);
	}
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
}

/** Whether a value is written as plain text, not JSON: anything but an object or an array. */
function isScalar(value: unknown): boolean {
	return value instanceof Date || typeof value !== 'object' || value === null;
}

/** Text with a `'` in front when a spreadsheet would run it as a formula. */
function guarded(value: string): string {
	return FORMULA_START.test(value) ? `'${value}` : value;
}

/** A cell's text in quotes, with any `"` in it doubled (RFC 4180). */
function quoted(value: string): string {
	return `"${value.replaceAll('"', '""')}"`;
}

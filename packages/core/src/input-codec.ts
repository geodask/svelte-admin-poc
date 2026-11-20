// The Field input codec: how a Field's value is written as the text of its HTML input, and how
// that text is read back into the Field's type. The forms and the filters both read and write
// their date inputs here, so a date that doesn't exist is never turned into another one in
// either. It goes by the input details a Field records (its `dateType`). Shared, pure.

import type { DateType } from './fields.ts';

/** A `datetime-local` input's value: a date and a time, to the minute or finer, with no zone. */
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;

/** A `date` input's value: a day, with no time. */
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * What a Field's date input sent, read into the Field's date type, or `undefined` when the input
 * is empty or holds no real date:
 *
 * - `datetime`: a `datetime-local` input's `YYYY-MM-DDTHH:mm`, seconds and milliseconds optional,
 *   read in UTC into an ISO datetime string (`2024-03-01T10:30:00.000Z`).
 * - `date`: a `date` input's `YYYY-MM-DD`, as sent: the ISO date string.
 * - `Date`: a `date` input's `YYYY-MM-DD`, as a `Date` at midnight UTC.
 *
 * A day or time that doesn't exist (30 February, month 13, 24 o'clock) is no date, never the
 * date it would roll over to. Nor is text the input never sends: a zone, a date without its
 * time or a time without its date, spaces, or words.
 */
export function readDateInput(dateType: DateType, text: string): string | Date | undefined {
	if (dateType === 'datetime') return readDatetime(text);
	const day = readDay(text);
	return dateType === 'Date' ? day : day && text;
}

/**
 * A Field's date value as its date input writes it, the text `readDateInput` reads back as the
 * same value: a datetime in UTC to the minute (`2024-03-01T23:30`), with its seconds, then its
 * milliseconds, only when they aren't zero; an ISO date as it is; and a `Date` as its UTC day
 * (`2024-03-01`). A value that is no date is written as text (an invalid `Date` as empty), so
 * an input shows it rather than throwing.
 */
export function writeDateInput(dateType: DateType, value: string | Date): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value instanceof Date ? '' : String(value);
	if (dateType === 'datetime') {
		return date
			.toISOString()
			.replace(/Z$/, '')
			.replace(/\.000$/, '')
			.replace(/:00$/, '');
	}
	return value instanceof Date ? date.toISOString().slice(0, 10) : value;
}

/** A `datetime-local` input's text as an ISO datetime string in UTC, or `undefined`. */
function readDatetime(text: string): string | undefined {
	if (!LOCAL_DATETIME.test(text)) return undefined;
	const date = new Date(`${text}Z`);
	if (Number.isNaN(date.getTime())) return undefined;
	const iso = date.toISOString();
	// A day or time out of range rolls over (February 30th is March 1st, 24:00 the next day), so
	// its day, hours, minutes or seconds read back changed. Milliseconds can't roll over.
	return iso.startsWith(text.slice(0, 19)) ? iso : undefined;
}

/** A `date` input's text as a `Date` at midnight UTC, or `undefined`. */
function readDay(text: string): Date | undefined {
	if (!LOCAL_DATE.test(text)) return undefined;
	const date = new Date(`${text}T00:00:00Z`);
	if (Number.isNaN(date.getTime())) return undefined;
	// As for a datetime, a day out of range rolls over, so it reads back changed.
	return date.toISOString().startsWith(text) ? date : undefined;
}

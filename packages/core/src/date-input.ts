// How a date and a datetime are written as the browser's `date` and `datetime-local` inputs write
// them: the forms prefill their inputs this way, and the list URL holds date filters this way, so
// the two always agree. Shared, pure.

/** A `datetime-local` input's value: a date and a time, to the minute or finer, with no zone. */
export const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;

/** A `date` input's value: a day, with no time. */
export const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A datetime as a `datetime-local` input writes it, in UTC: `2024-03-01T23:30:15.250Z` is
 * `2024-03-01T23:30:15.250`, without the milliseconds, then the seconds, when they are zero.
 * Text that is no date is written as it is.
 */
export function datetimeInputValue(value: string | Date): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return String(value);
	return date
		.toISOString()
		.replace(/Z$/, '')
		.replace(/\.000$/, '')
		.replace(/:00$/, '');
}

/** A `Date` as a `date` input writes it: its day in UTC. */
export function dateInputValue(value: Date): string {
	return value.toISOString().slice(0, 10);
}

/**
 * What a `datetime-local` input sent, read in UTC as an ISO datetime string, or `undefined` when
 * it is no real date and time (month 13, February 30th, 25 o'clock).
 */
export function readDatetimeInput(text: string): string | undefined {
	if (!LOCAL_DATETIME.test(text)) return undefined;
	const date = new Date(`${text}Z`);
	if (Number.isNaN(date.getTime())) return undefined;
	const iso = date.toISOString();
	// A day or time out of range rolls over (February 30th is March 1st, 24:00 the next day), so
	// its day, hours, minutes or seconds read back changed. Milliseconds can't roll over.
	return iso.startsWith(text.slice(0, 19)) ? iso : undefined;
}

/**
 * What a `date` input sent, as a `Date` at midnight UTC, or `undefined` when it is no real day
 * (month 13, February 30th).
 */
export function readDateInput(text: string): Date | undefined {
	if (!LOCAL_DATE.test(text)) return undefined;
	const date = new Date(`${text}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && dateInputValue(date) === text ? date : undefined;
}

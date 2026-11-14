import type { RecordOf, Resource } from './resource.ts';

/** The Fields that name a record, in the order the default rule tries them before the id. */
export const TITLE_KEYS: readonly string[] = ['name', 'title'];

/**
 * The Record title: the text that names one record, e.g. as the detail View's heading. The
 * default rule takes the `name` Field, else the `title` Field, else the id. A Field counts only
 * when the Resource shows it (a hidden Field never names a record) and its value isn't empty.
 * The `recordTitle` setting comes later.
 */
export function recordTitle<R extends Resource>(resource: R, record: RecordOf<R>): string {
	const values = record as Record<string, unknown>;
	for (const key of TITLE_KEYS) {
		const shown = resource.fields.some((field) => field.key === key && field.detail);
		const value = values[key];
		if (shown && value !== undefined && value !== null && String(value) !== '') {
			return String(value);
		}
	}
	return String(values.id);
}

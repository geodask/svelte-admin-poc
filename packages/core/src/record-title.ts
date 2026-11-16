import type { Field } from './fields.ts';
import type { RecordOf, Resource } from './resource.ts';

/** The Fields that name a record, in the order the default rule tries them before the id. */
export const TITLE_KEYS: readonly string[] = ['name', 'title'];

/** The value as a title, or `undefined` when it is empty and so names nothing. */
function asTitle(value: unknown): string | undefined {
	if (value === undefined || value === null) return undefined;
	const text = String(value);
	return text === '' ? undefined : text;
}

/**
 * The Fields that may name a record, in the order they are tried before the id: the one a
 * `recordTitle` key names (`defineResource` has checked that it is shown), else the shown ones
 * of `name` and `title`. A function setting names no Field, so it gets the default ones, which
 * the list View still links by.
 */
export function titleKeys(resource: Resource): readonly string[] {
	const setting = resource.recordTitle;
	if (typeof setting === 'string') return [setting];
	return TITLE_KEYS.filter((key) =>
		resource.fields.some((field) => field.key === key && field.detail)
	);
}

/**
 * The Record title: the text that names one record, e.g. as the detail View's heading. With
 * the Resource's `recordTitle` setting, it is the value of the Field that setting names, or the
 * function's result. Without it, the default rule takes the `name` Field, else the `title`
 * Field, else the id; a Field counts only when the Resource shows it (a hidden Field never names
 * a record). Either way an empty value falls back to the id, so a record is never named by
 * nothing.
 */
export function recordTitle<R extends Resource>(resource: R, record: RecordOf<R>): string {
	const values = record as Record<string, unknown>;
	const setting = resource.recordTitle;
	const title =
		typeof setting === 'function'
			? asTitle(setting(record))
			: titleKeys(resource)
					.map((key) => asTitle(values[key]))
					.find((text) => text !== undefined);
	return title ?? String(values.id);
}

/**
 * Fails at startup when a `recordTitle` key names no Field, which TypeScript already rejects
 * (this catches JavaScript and casts), or names a hidden Field, which no View may show.
 */
export function assertRecordTitle(
	name: string,
	fields: readonly Field[],
	setting: Resource['recordTitle']
): void {
	if (typeof setting !== 'string') return;
	const field = fields.find((candidate) => candidate.key === setting);
	if (field === undefined) {
		throw new Error(
			`Resource "${name}": \`recordTitle\` names "${setting}", which is not one of its Fields.`
		);
	}
	if (!field.detail) {
		throw new Error(
			`Resource "${name}": \`recordTitle\` names the hidden Field "${setting}". A Record title ` +
				'is shown wherever the admin names a record, so it must come from a Field that is shown.'
		);
	}
}

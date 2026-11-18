// A Reference's link: the target record's Record title and the href of its detail View, for the
// list and detail Views. Shared and browser-safe: it reaches the target through the admin, so it
// imports no remote module itself.
import type { Admin } from './admin.ts';
import type { Field } from './fields.ts';
import { hasPathSegment, recordPath } from './ids.ts';
import { recordTitle } from './record-title.ts';

/**
 * A Reference shown by the record it points to: that record's Record title, and the href of its
 * detail View under the admin's base path (`undefined` for an id no URL can hold as one segment).
 */
export type ReferenceLink = { title: string; href: string | undefined };

/**
 * The link a Reference's value resolves to: the target record's Record title and the href of its
 * detail View, read through the target's remote `lookup`, so the References a page shows in the
 * same tick share one request. `undefined` when the record doesn't exist or the lookup failed, so
 * a View shows the raw id instead and never fails for it; also for an empty value and for a Field
 * that isn't a Reference, which ask for nothing. It works during SSR, so a page without JavaScript
 * shows titles too.
 */
export async function resolveReference(
	admin: Admin,
	field: Field,
	value: unknown
): Promise<ReferenceLink | undefined> {
	if (field.kind !== 'reference') return undefined;
	if (typeof value !== 'string' && typeof value !== 'number') return undefined;
	const target = field.ref();
	// `defineAdmin` has checked that the target is mounted under its name.
	const entry = admin.resources[target.name];
	try {
		const remote = await entry.remote();
		const record: unknown = await remote.lookup(value);
		if (typeof record !== 'object' || record === null) return undefined;
		const listPath = `${admin.basePath}/${target.name}`;
		return {
			title: recordTitle(target, record as Record<string, unknown>),
			href: hasPathSegment(value) ? recordPath(listPath, value) : undefined
		};
	} catch {
		// A failed lookup leaves the raw id; the list or detail View still renders.
		return undefined;
	}
}

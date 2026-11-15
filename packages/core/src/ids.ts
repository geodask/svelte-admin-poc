import type { z } from 'zod';
import type { IdOf, Resource } from './resource.ts';

/**
 * Whether `idPathSegment` can write this id, i.e. whether a record with it can have a URL. No
 * URL keeps an empty id as one segment (it collapses into its parent's path), nor `.` or `..`,
 * which URL parsers resolve as dot segments, escaped or not.
 */
export function hasPathSegment(id: string | number): boolean {
	const text = String(id);
	return text !== '' && text !== '.' && text !== '..';
}

/**
 * An id as one URL path segment, for a Provider's upstream URLs and the admin's own record
 * hrefs. Every character that could end the segment (`/`, `?`, `#`) or change its meaning (`%`)
 * is escaped, so a crafted id such as `../users/1` stays one segment and can never reach a
 * different record. An id that no URL keeps as one segment (empty, `.` or `..`) is an error.
 */
export function idPathSegment(id: string | number): string {
	if (!hasPathSegment(id)) {
		throw new Error(`The id ${JSON.stringify(String(id))} cannot be one URL path segment`);
	}
	return encodeURIComponent(String(id));
}

/** The path segment of a Resource's create View, `{list}/new`, which therefore names no id. */
export const CREATE_SEGMENT = 'new';

/**
 * The list View's path for a create View's path (`{list}/new`), or `undefined` for any other
 * path, including one that starts with `//`, which a browser would follow to another host.
 */
export function listPathOfCreateView(pathname: string): string | undefined {
	const suffix = `/${CREATE_SEGMENT}`;
	if (!pathname.endsWith(suffix) || pathname.startsWith('//')) return undefined;
	const list = pathname.slice(0, -suffix.length);
	return list.startsWith('/') ? list : undefined;
}

/** The last path segment of a record's edit View, `{list}/{id}/edit`. */
export const EDIT_SEGMENT = 'edit';

/**
 * The list View's path for an edit View's path (`{list}/{id}/edit`), or `undefined` for any
 * other path, including one that starts with `//`, which a browser would follow to another host.
 */
export function listPathOfEditView(pathname: string): string | undefined {
	const suffix = `/${EDIT_SEGMENT}`;
	if (!pathname.endsWith(suffix) || pathname.startsWith('//')) return undefined;
	const detail = pathname.slice(0, -suffix.length);
	const list = detail.slice(0, detail.lastIndexOf('/'));
	return list.startsWith('/') && list.length < detail.length - 1 ? list : undefined;
}

/**
 * The typed id a route param names, or `undefined` when it names none, which a route answers
 * with a 404 so the Provider is never asked. The param goes through the Resource's id schema,
 * which never coerces: for a number id, only a number written as `String(id)` writes it (`1`,
 * not `01`, `1.0` or `1e0`), so each id has exactly one URL.
 *
 * `new` names no id, even for string ids: `{list}/new` is the create View. So a record whose id
 * is literally `new` has no detail URL. That is a known limit, not handled.
 */
export function idFromParam<R extends Resource>(resource: R, param: string): IdOf<R> | undefined {
	if (!hasPathSegment(param) || param === CREATE_SEGMENT) return undefined;
	const schema = resource.schema.shape.id as z.ZodType;

	const asString = schema.safeParse(param);
	if (asString.success) return asString.data as IdOf<R>;

	const number = Number(param);
	if (!Number.isFinite(number) || String(number) !== param) return undefined;
	const asNumber = schema.safeParse(number);
	return asNumber.success ? (asNumber.data as IdOf<R>) : undefined;
}

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
 * The detail View's path for an edit View's path (`{list}/{id}/edit` gives `{list}/{id}`), or
 * `undefined` for any other path, including one that starts with `//`, which a browser would
 * follow to another host.
 */
export function detailPathOfEditView(pathname: string): string | undefined {
	const suffix = `/${EDIT_SEGMENT}`;
	if (!pathname.endsWith(suffix) || pathname.startsWith('//')) return undefined;
	const detail = pathname.slice(0, -suffix.length);
	const slash = detail.lastIndexOf('/');
	// A list path and a non-empty id segment.
	return slash > 0 && slash < detail.length - 1 ? detail : undefined;
}

/** The list View's path for an edit View's path (`{list}/{id}/edit`), or `undefined`. */
export function listPathOfEditView(pathname: string): string | undefined {
	const detail = detailPathOfEditView(pathname);
	return detail?.slice(0, detail.lastIndexOf('/'));
}

/**
 * A path with one more segment: the one join every path the admin builds from its base path or a
 * list View's path goes through. A path that already ends in `/` (the root, `/`, for an admin
 * mounted there) takes the segment without another slash, so `/` and `users` give `/users`,
 * never `//users`, which a browser would follow to another host.
 */
export function joinPath(path: string, segment: string): string {
	return `${path.endsWith('/') ? path.slice(0, -1) : path}/${segment}`;
}

/** The path of a record's detail View under its list View's path: `{list}/{id}`. */
export function recordPath(listPath: string, id: string | number): string {
	return joinPath(listPath, idPathSegment(id));
}

/** The path of a Resource's create View under its list View's path: `{list}/new`. */
export function createPath(listPath: string): string {
	return joinPath(listPath, CREATE_SEGMENT);
}

/** The path of a record's edit View under its list View's path: `{list}/{id}/edit`. */
export function editPath(listPath: string, id: string | number): string {
	return joinPath(recordPath(listPath, id), EDIT_SEGMENT);
}

/** A path segment, decoded, or `undefined` when it is malformed. */
export function decodeSegment(segment: string): string | undefined {
	try {
		return decodeURIComponent(segment);
	} catch {
		return undefined;
	}
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
	return idFromText(resource.schema.shape.id as z.ZodType, param) as IdOf<R> | undefined;
}

/**
 * The id written as `text`, read with an id schema, or `undefined` when it names none: the rule a
 * route param is read by, also used for a Reference's filter value in the list URL. The text goes
 * through the schema, which never coerces: for a number id, only a number written as
 * `String(id)` writes it (`1`, not `01`, `1.0` or `1e0`).
 */
export function idFromText(schema: z.ZodType, text: string): string | number | undefined {
	const asString = schema.safeParse(text);
	if (asString.success) return asString.data as string;

	const number = Number(text);
	if (!Number.isFinite(number) || String(number) !== text) return undefined;
	const asNumber = schema.safeParse(number);
	return asNumber.success ? (asNumber.data as number) : undefined;
}

import { page } from '$app/state';
import { EDIT_SEGMENT, idPathSegment } from './ids.ts';
import { recordTitle } from './record-title.ts';
import type { ResourceRemote } from './remote.ts';
import type { IdOf, RecordOf, Resource } from './resource.ts';

/**
 * The headless detail View: the Fields to show, the query for the record, its Record title, and
 * the href of the list it belongs to. The Theme's detail View is built on it, and so can a
 * replaced View. It takes the Resource as an argument, not from context.
 *
 * The id must already be the Resource's typed id: a route turns its param into one with
 * `idFromParam` and answers a param that names none with a 404, so the Provider never sees it.
 *
 * In a component whose Resource or id can change, wrap the call in `$derived`.
 *
 * @example
 * const view = createDetailView(recipes, remote, id);
 * const record = $derived(await view.query);
 */
export function createDetailView<R extends Resource>(
	resource: R,
	remote: ResourceRemote<RecordOf<R>, IdOf<R>>,
	id: IdOf<R>
) {
	// The detail View sits one segment under its list, so the list's path carries the base path.
	const listViewHref = $derived(page.url.pathname.replace(/\/[^/]*$/, ''));

	return {
		resource,
		/** The Fields the detail View shows: every Field that isn't hidden, in schema order. */
		fields: resource.fields.filter((field) => field.detail),
		/** The record. Await it: `$derived(await view.query)`. */
		get query() {
			return remote.getOne(id);
		},
		/**
		 * Load the record again, from the server. A Retry after a failure calls it before
		 * rendering the record again, since a failed read otherwise stays failed.
		 */
		refresh(): Promise<void> {
			return remote.getOne(id).refresh();
		},
		/** The text that names the record, e.g. for the heading. */
		title(record: RecordOf<R>): string {
			return recordTitle(resource, record);
		},
		/** The href of the Resource's list View. */
		get listViewHref(): string {
			return listViewHref;
		},
		/** The href of the record's edit View, `{list}/{id}/edit`. */
		get editHref(): string {
			return `${listViewHref}/${idPathSegment(id)}/${EDIT_SEGMENT}`;
		}
	};
}

/** What `createDetailView` returns. */
export type DetailViewState<R extends Resource = Resource> = ReturnType<typeof createDetailView<R>>;

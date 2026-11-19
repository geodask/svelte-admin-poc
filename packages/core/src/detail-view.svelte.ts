import { goto } from '$app/navigation';
import { page } from '$app/state';
import type { Admin } from './admin.ts';
import type { Field } from './fields.ts';
import { resolveReference, type ReferenceLink } from './reference-link.ts';
import { editPath } from './ids.ts';
import { recordTitle } from './record-title.ts';
import type { DeleteFailure, ResourceRemote } from './remote.ts';
import { readRemoteFailure } from './remote-failure.ts';
import type { IdOf, RecordOf, Resource } from './resource.ts';

/**
 * How a delete ended: the record is gone (and the list View is on its way), or it failed with
 * a message that is safe to show and, when the server answered, its HTTP status (404 for a
 * record that was already deleted).
 */
export type DeleteResult = { ok: true } | ({ ok: false } & DeleteFailure);

/** What a delete reports when the failure carries no message of its own (e.g. no network). */
const DELETE_FAILED = "Couldn't delete this record.";

/**
 * The headless detail View: the Fields to show, the query for the record, its Record title, the
 * href of the list it belongs to, and a delete. The Theme's detail View is built on it, and so
 * can a replaced View. It takes the admin from `admin.ts` and the Resource as arguments, not
 * from context.
 *
 * The id must already be the Resource's typed id: a route turns its param into one with
 * `idFromParam` and answers a param that names none with a 404, so the Provider never sees it.
 *
 * In a component whose Resource or id can change, wrap the call in `$derived`.
 *
 * @example
 * const view = createDetailView(admin, recipes, remote, id);
 * const record = $derived(await view.query);
 */
export function createDetailView<R extends Resource>(
	// How the detail View reaches the admin's other Resources, e.g. a Reference's target.
	admin: Admin,
	resource: R,
	remote: ResourceRemote<RecordOf<R>, IdOf<R>>,
	id: IdOf<R>
) {
	// The detail View sits one segment under its list, so the list's path carries the base path.
	const listViewHref = $derived(page.url.pathname.replace(/\/[^/]*$/, ''));

	return {
		resource,
		/** The admin from `admin.ts`, which the Theme's parts take to show References. */
		admin,
		/**
		 * What a Reference's value links to: the target record's Record title and the href of its
		 * detail View, or `undefined` when the record doesn't exist or the lookup failed, so the
		 * View shows the raw id. The References a page shows share one request per target, and they
		 * resolve during SSR. Await it, e.g. `$derived(await view.reference(field, value))`.
		 */
		reference(field: Field, value: unknown): Promise<ReferenceLink | undefined> {
			return resolveReference(admin, field, value);
		},
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
			return editPath(listViewHref, id);
		},
		/**
		 * Delete the record, then go to the list View, which the server has refreshed. It needs
		 * JavaScript (it calls the remote `deleteOne` command), so render its control only after
		 * hydration. It never rejects: a failure is reported with its message, so a dialog can
		 * show it and offer to try again.
		 */
		async delete(): Promise<DeleteResult> {
			// Read now: once the delete lands, the route may already be changing.
			const target = listViewHref;
			try {
				await remote.deleteOne(id).updates(remote.getList);
			} catch (failure) {
				return { ok: false, ...readRemoteFailure(failure, DELETE_FAILED) };
			}
			// The delete succeeded whatever happens to the navigation: one the user started
			// meanwhile may supersede it, and that is theirs to keep.
			await goto(target).catch(() => {});
			return { ok: true };
		}
	};
}

/** What `createDetailView` returns. */
export type DetailViewState<R extends Resource = Resource> = ReturnType<typeof createDetailView<R>>;

import { settled } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';
import type { Admin } from './admin.ts';
import { resolveReference, type ReferenceLink } from './reference-link.ts';
import { createReferencePicker, type ReferencePicker } from './reference-picker.ts';
import { createPath, hasPathSegment, recordPath } from './ids.ts';
import type { Field } from './fields.ts';
import {
	filterState,
	type FilterChip,
	type FilterControl,
	type HiddenInput
} from './filter-state.ts';
import type { FilterValue, ListParams, SortableKey, SortOrder } from './provider.ts';
import { createKitListRouter } from './kit-list-router.svelte.ts';
import { createListLocation } from './list-location.ts';
import { titleKeys } from './record-title.ts';
import type { DeleteFailure, ExportSummary, RemoteFailure, ResourceRemote } from './remote.ts';
import { readRemoteFailure } from './remote-failure.ts';
import { downloadCsv, today } from './download.ts';
import type { IdOf, RecordOf, Resource } from './resource.ts';

/**
 * The stock page sizes a list View offers, beside the Resource's own. Any size from 1 to the cap
 * still works from the URL.
 */
const PER_PAGE_OPTIONS: readonly number[] = [10, 25, 50, 100];

/** What a bulk delete reports when the failure carries no message of its own (e.g. no network). */
const BULK_DELETE_FAILED = "Couldn't delete the selected records.";

/** What an export reports when the failure carries no message of its own (e.g. no network). */
const EXPORT_FAILED = "Couldn't export the records.";

/**
 * How a bulk delete of the selected rows ended: every one is gone, or it failed (perhaps
 * partway) with a message that is safe to show and, when the server answered, its HTTP status.
 * Either way `deleted` is how many records were deleted; those are no longer selected, and the
 * rest still are.
 */
export type BulkDeleteResult =
	{ ok: true; deleted: number } | ({ ok: false; deleted: number } & DeleteFailure);

/**
 * How an export of the list ended: the file was downloaded, with what it holds (how many records,
 * whether it stopped at the cap with more left, and the Provider's total when it counts); or it
 * failed, with a message that is safe to show and, when the server answered, its HTTP status. A
 * failed export downloads nothing.
 */
export type ExportResult = ({ ok: true } & ExportSummary) | ({ ok: false } & RemoteFailure);

/**
 * A GET form that keeps some list params as hidden inputs: where it goes, and each hidden input's
 * name and value.
 */
export type KeptForm = { action: string; hidden: HiddenInput[] };

/**
 * The headless list View: the Fields to show, the list params in the URL, the query to await,
 * the hrefs that change page, page size and sort, each record's href, the search box's state, and
 * the filter controls, form and active filters.
 * The Theme's list View is built on it, and so can a replaced View. It takes the admin from
 * `admin.ts` and the Resource as arguments, not from context.
 *
 * The URL holds the list params. A bad value or an unknown param in it is dropped, and with
 * JavaScript the URL is rewritten in place (`replace`, so no history entry is added). On a
 * searchable Resource, typing a search writes it to the URL after a short pause, also in place,
 * and starts again at page 1. Until then the typed text and the selection are the only state
 * outside the URL.
 *
 * The selection belongs to the Resource the list View was made for: it holds that Resource's
 * ids, with their canonical type, and a list View for another Resource starts with none. It
 * lasts while the list View does, across pages, searches, sorts and filters, and is never in the
 * URL.
 *
 * Call it during component setup. In a component whose Resource can change, wrap the call in
 * `$derived`, so the list View follows the Resource: each Resource then gets a new list View,
 * with a selection of its own that starts empty.
 *
 * @example
 * const view = createListView(admin, recipes, remote);
 * const result = $derived(await view.query);
 */
export function createListView<R extends Resource>(
	// How the list View reaches the admin's other Resources, e.g. a Reference's target.
	admin: Admin,
	resource: R,
	remote: ResourceRemote<RecordOf<R>, IdOf<R>, ListParams<R>>
) {
	const fields = resource.fields.filter((field) => field.list);
	// The admin entries of the Resources the list's References point to.
	const referenceTargets = fields.flatMap((field) =>
		field.kind === 'reference' ? [admin.resources[field.ref().name]] : []
	);

	// The list location owns the URL, the params, the pager and sort hrefs, the search, the URL
	// cleanup and the filter form: it is the one place that navigates for the list. It holds no
	// reactive state of its own, so it says when the search text changes, and the search box reads
	// it again. Kit's adapter reads Kit's router state, which is reactive, so what is derived from
	// the list location follows the URL.
	let searchChanges = $state(0);
	const listLocation = createListLocation(resource, createKitListRouter(), {
		onChange: () => searchChanges++,
		// A workaround: Kit's router (3.2) crashes on a navigation that starts while hydration still
		// waits for something the page loads, here the page of records or the remote module of a
		// Reference's target, which each cell imports to resolve its title. So the URL cleanup waits
		// for both (`getList` answers from the query cache the page already holds, without a
		// request), then for `settled()`, so the cells that awaited them have rendered too. Drop it
		// once Kit handles such a navigation.
		ready: (): Promise<unknown> =>
			Promise.allSettled([
				remote.getList(params),
				...referenceTargets.map((entry) => entry.remote())
			]).then(() => settled())
	});
	const url = $derived(listLocation.url);
	const params = $derived(listLocation.params);
	// The stock page sizes, with the Resource's own in its place among them.
	const perPageOptions: readonly number[] = PER_PAGE_OPTIONS.includes(resource.perPage)
		? PER_PAGE_OPTIONS
		: [...PER_PAGE_OPTIONS, resource.perPage].sort((a, b) => a - b);
	// The Fields that name a record, as the Record title tries them, then the id.
	const linkField =
		[...titleKeys(resource), 'id']
			.map((key) => fields.find((field) => field.key === key))
			.find(Boolean) ?? fields[0];

	// Clean the URL whenever it changes: the one the page was opened with, or one typed in the
	// address bar. The list location skips a rewrite a newer navigation has overtaken.
	$effect(() => {
		void listLocation.cleanUp();
	});

	// Leaving the list (or switching Resource) drops a search or a cleanup that was still waiting.
	$effect(() => () => listLocation.dispose());

	// The search and the sort in the URL, if any. Read through the loose `ListParams`, since a
	// Resource that isn't searchable has no `search` in its own, and one with no sortable Field no
	// `sort`.
	const looseParams = $derived(params satisfies ListParams as ListParams);
	const urlSearch = $derived(looseParams.search);
	const filterCount = $derived(looseParams.filters?.length ?? 0);

	const selection = createSelection<IdOf<R>>();

	// Each Reference filter's picker, kept while the id it is filtered by stays the same, so a
	// change of page, sort or another filter doesn't load the target's records again.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a cache, never read reactively
	const pickers = new Map<string, { current: string; picker: ReferencePicker }>();

	/** The picker of a Reference filter on `field`, filtered by the id `current` now. */
	function picker(field: Field, current: string): ReferencePicker {
		const kept = pickers.get(field.key);
		if (kept?.current === current) return kept.picker;
		const made = createReferencePicker(admin, field, current);
		pickers.set(field.key, { current, picker: made });
		return made;
	}

	/** A Reference filter value's Record title, through the target's lookup in the admin. */
	async function title(field: Field, value: FilterValue): Promise<string | undefined> {
		return (await resolveReference(admin, field, value))?.title;
	}

	// The filter controls, the chips and the hidden inputs the forms keep, for the params in the
	// URL. The chips' hrefs are the list location's, so they keep the list's path.
	const filters = $derived(
		filterState(resource, params, { picker, title, href: (next) => listLocation.href(next) })
	);

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
		/** The Fields the list View shows, in schema order. */
		fields,
		/**
		 * The page, page size, sort, search and filters in the URL, with defaults for what it leaves
		 * out (the Resource's own page size and default sort), typed from the Resource: a search only
		 * for a searchable one, a sort only for one with a sortable Field, and filters only for one
		 * with a filterable Field.
		 */
		get params(): ListParams<R> {
			return params;
		},
		/** The current page of records. Await it: `$derived(await view.query)`. */
		get query() {
			return remote.getList(params);
		},
		/**
		 * Load the current page again, from the server. A Retry after a failure calls it before
		 * rendering the list again, since a failed page otherwise stays failed.
		 */
		refresh(): Promise<void> {
			return remote.getList(params).refresh();
		},
		/**
		 * The Field whose cell links each row to its record's detail View: the Field the
		 * Resource's `recordTitle` key names (or, without a key, `name`, else `title`), else the
		 * id, else the first Field shown, taking the first of these the list shows.
		 */
		linkField,
		/**
		 * The href of a record's detail View, under the list's own path, so it carries the admin's
		 * base path. The id is one path segment. `undefined` for the rare id no URL can hold as one
		 * segment (empty, `.` or `..`): that record has no detail View link.
		 */
		recordHref(record: RecordOf<R>): string | undefined {
			const id = (record as { id: IdOf<R> }).id;
			return hasPathSegment(id) ? recordPath(url.pathname, id) : undefined;
		},
		/** The href of the Resource's create View, `{list}/new`, under the list's own path. */
		get createHref(): string {
			return createPath(url.pathname);
		},
		/**
		 * What to say when the page has no records: that none match the search, the filters, or
		 * both, that the page is past the last one, or that the Resource has none yet.
		 */
		get emptyMessage(): string {
			const records = resource.label.toLowerCase();
			if (urlSearch !== undefined && filterCount > 0) {
				return `No ${records} match “${urlSearch}” and the filters.`;
			}
			if (urlSearch !== undefined) return `No ${records} match “${urlSearch}”.`;
			if (filterCount > 0) return `No ${records} match the filters.`;
			return `No ${records} ${params.page > 1 ? 'on this page' : 'yet'}.`;
		},
		/**
		 * The order the list is sorted by a Field in: `'asc'`, `'desc'`, or `undefined` when the
		 * list isn't sorted by it. With no sort in the URL, the list is sorted by the Resource's
		 * default sort, if it has one.
		 */
		// Methods, like the selection's, so a list View for one Resource still stands in for any
		// Resource's, as the Theme's parts take it.
		sortState(key: SortableKey<R>): SortOrder | undefined {
			return listLocation.sortState(key);
		},
		/**
		 * The href that sorts the list by a sortable Field, for its column header: ascending, then
		 * descending once it is sorted ascending, then back to the Resource's default sort (or no
		 * sort, without one) once it is sorted descending. The default sort's own Field toggles
		 * between the two orders instead, so the list is never left unsorted. It starts again at
		 * page 1 and keeps the search, the filters and the page size.
		 */
		sortHref(key: SortableKey<R>): string {
			return listLocation.sortHref(key);
		},
		/**
		 * The page sizes to offer, as plain links, smallest first: 10, 25, 50 and 100, plus the
		 * Resource's own `perPage` when it isn't one of them.
		 */
		perPageOptions,
		/** The href of another page, at the same page size. */
		pageHref(target: number): string {
			return listLocation.pageHref(target);
		},
		/** The href of the first page at another page size, keeping the search, sort and filters. */
		perPageHref(perPage: number): string {
			return listLocation.perPageHref(perPage);
		},
		/** Whether to offer a search box: only on a searchable Resource. */
		searchable: resource.searchable,
		/** The text for the search box: what is being typed, else the search in the URL. */
		get search(): string {
			void searchChanges;
			return listLocation.search;
		},
		/**
		 * Take what was typed in the search box. It reaches the URL once typing pauses, in place,
		 * unless a navigation the person starts meanwhile (a pager or sort link, Back) cancels it.
		 */
		setSearch(text: string) {
			listLocation.setSearch(text);
		},
		/** Write the search box's text to the URL now, e.g. when its form is submitted. */
		submitSearch() {
			listLocation.submitSearch();
		},
		/** The rows selected in this Resource's list, by id. See `createSelection`. */
		selection,
		/**
		 * Delete every selected row, on every page, through the remote `deleteMany`, which
		 * refreshes the list queries along with it. On success the selection is cleared. If it
		 * fails partway, only the deleted rows leave the selection, so the rest are ready to try
		 * again. It needs JavaScript, so render its control only after hydration. It never
		 * rejects: a failure is reported with its message, so a dialog can show it.
		 *
		 * The selection only ever holds this Resource's ids, so it can't delete another's records.
		 */
		async deleteSelected(): Promise<BulkDeleteResult> {
			const ids = selection.ids;
			if (ids.length === 0) return { ok: true, deleted: 0 };
			let report;
			try {
				report = await remote.deleteMany(ids).updates(remote.getList);
			} catch (failure) {
				return { ok: false, deleted: 0, ...readRemoteFailure(failure, BULK_DELETE_FAILED) };
			}
			// The deleted ids are the first ones sent, in order.
			selection.setAll(ids.slice(0, report.deleted), false);
			return 'failure' in report
				? { ok: false, deleted: report.deleted, ...report.failure }
				: { ok: true, deleted: report.deleted };
		},
		/**
		 * Export every record that matches the list's search, sort and filters, on every page, as
		 * CSV through the remote `exportList`, and download it as `{resource}-{YYYY-MM-DD}.csv`
		 * (today, where the browser is). The export stops at the Resource's cap, and says so. It
		 * needs JavaScript, so render its control only after hydration. It never rejects: a failure
		 * is reported with its message, and downloads nothing.
		 */
		async exportCsv(): Promise<ExportResult> {
			// The page and the page size don't narrow an export: it holds every page.
			// eslint-disable-next-line @typescript-eslint/no-unused-vars -- left out on purpose
			const { page: _page, perPage: _perPage, ...query } = params;
			let report;
			try {
				report = await remote.exportList(query);
			} catch (failure) {
				return { ok: false, ...readRemoteFailure(failure, EXPORT_FAILED) };
			}
			const { csv, ...summary } = report;
			downloadCsv(csv, `${resource.name}-${today()}.csv`);
			return { ok: true, ...summary };
		},
		/**
		 * The GET form the search box sits in, so search works without JavaScript too: where it
		 * goes, the name of its search box, and the params it keeps as hidden inputs (a page size
		 * and a sort that aren't the Resource's defaults, and the filters, never the page). The form
		 * names no empty param.
		 */
		get searchForm(): KeptForm & { name: 'q' } {
			return { action: url.pathname, hidden: filters.hidden.searchForm, name: 'q' };
		},
		/**
		 * The filter controls to offer: one per filterable Field that isn't hidden, in schema order,
		 * for the Fields a stock control fits (see `FilterControl`). Filters on other Fields, and with
		 * operators no control offers, still work from the URL.
		 */
		get filterControls(): FilterControl[] {
			return filters.controls;
		},
		/** How many filters the list is filtered by now. */
		get filterCount(): number {
			return filterCount;
		},
		/**
		 * The GET form the filter controls sit in, so filters work without JavaScript too: where it
		 * goes, and the params it keeps as hidden inputs (the search, a sort and a page size that
		 * aren't the Resource's defaults, and the filters no control sends, such as one on a hidden
		 * Field; never the page, so it starts again at page 1). Without JavaScript it sends its empty
		 * controls too, which the list URL ignores; with it, submit through `applyFilters`, which
		 * leaves them out.
		 */
		get filterForm(): KeptForm {
			return { action: url.pathname, hidden: filters.hidden.filterForm };
		},
		/**
		 * The active filter chips under the toolbar: one per filter the list is filtered by now,
		 * whatever its operator (including ones no filter control offers) and whether or not its
		 * Field is hidden, in the canonical order. Each is a set of parts (see `FilterChip`), not a
		 * finished label: its Field, its operator, its values (a Reference's with its record's
		 * Record title, when found) and the href of the list without it, which starts again at page
		 * 1 and keeps the search, the sort, the page size and every other filter. The Theme writes
		 * the chip's text from them, with the formatting its cells use. Empty while no filter is on.
		 * It resolves during SSR: await it, e.g. `$derived(await view.activeFilters)`.
		 */
		get activeFilters(): Promise<FilterChip[]> {
			return filters.chips;
		},
		/** The href of the list with no filters, at page 1, keeping the search, sort and page size. */
		get clearFiltersHref(): string {
			return listLocation.href({ ...looseParams, page: 1, filters: undefined });
		},
		/**
		 * Filter the list by what the filter form holds (its controls and hidden inputs): go to the
		 * clean href it names, with no empty param, at page 1. A navigation that adds a history
		 * entry, so Back undoes it; the scroll and focus stay where they are. It cancels a search
		 * still waiting: the list keeps the search the URL had, which the form holds.
		 */
		applyFilters(formData: FormData): Promise<void> {
			return listLocation.applyFilters(filters.nextParams(formData));
		}
	};
}

/**
 * A list View's selection: the ids of the rows a person has checked, for one Resource. Each
 * list View makes its own for the Resource it was made for, so the ids in it always belong to
 * that Resource, and they keep its id type (a number id stays a number). "On the page" means
 * the ids of the records the list View shows now, which the caller passes in, since the page is
 * loaded by `query`.
 */
function createSelection<Id extends string | number>() {
	const ids = new SvelteSet<Id>();

	/** Select every row given, or clear every one of them. */
	function setAll(pageIds: readonly Id[], selected: boolean) {
		for (const id of pageIds) {
			if (selected) ids.add(id);
			else ids.delete(id);
		}
	}

	return {
		/** Whether a row is selected. */
		has(id: Id): boolean {
			return ids.has(id);
		},
		/** Select a row, or clear it: `selected` defaults to the opposite of what it is now. */
		toggle(id: Id, selected = !ids.has(id)) {
			setAll([id], selected);
		},
		// A method like `has` and `toggle`, not a function-valued property, so TypeScript lets a
		// list View for one Resource stand in for any Resource's, as the Theme's parts take it.
		/** Select every row on the page, or clear every one of them. Other pages keep theirs. */
		setAll(pageIds: readonly Id[], selected: boolean) {
			setAll(pageIds, selected);
		},
		/** Whether the page has rows and every one of them is selected. */
		allSelected(pageIds: readonly Id[]): boolean {
			return pageIds.length > 0 && pageIds.every((id) => ids.has(id));
		},
		/** Whether some rows on the page are selected, but not all: the select-all mixed state. */
		someSelected(pageIds: readonly Id[]): boolean {
			const count = pageIds.filter((id) => ids.has(id)).length;
			return count > 0 && count < pageIds.length;
		},
		/** How many rows are selected, on every page. */
		get size(): number {
			return ids.size;
		},
		/** The selected ids, in the order they were selected, e.g. for a bulk action. */
		get ids(): Id[] {
			return [...ids];
		}
	};
}

/** A list View's selection, for a Resource with ids of type `Id`. */
export type ListSelection<Id extends string | number = string | number> = ReturnType<
	typeof createSelection<Id>
>;

/** What `createListView` returns. */
export type ListViewState<R extends Resource = Resource> = ReturnType<typeof createListView<R>>;

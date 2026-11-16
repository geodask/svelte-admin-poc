import { goto } from '$app/navigation';
import { page } from '$app/state';
import { untrack } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';
import { CREATE_SEGMENT, hasPathSegment, recordPath } from './ids.ts';
import type { Field } from './fields.ts';
import type { FilterValue, ListParams, SortableKey, SortOrder } from './provider.ts';
import { listHref, listUrlRewrite, readListParams } from './list-url.ts';
import { titleKeys } from './record-title.ts';
import type { DeleteFailure, ResourceRemote } from './remote.ts';
import { readDeleteFailure } from './delete-failure.ts';
import type { IdOf, RecordOf, Resource } from './resource.ts';

/**
 * The stock page sizes a list View offers, beside the Resource's own. Any size from 1 to the cap
 * still works from the URL.
 */
const PER_PAGE_OPTIONS: readonly number[] = [10, 25, 50, 100];

/** How long typing must pause before a search is written to the URL. */
const SEARCH_DEBOUNCE_MS = 300;

/** What a bulk delete reports when the failure carries no message of its own (e.g. no network). */
const BULK_DELETE_FAILED = "Couldn't delete the selected records.";

/**
 * How a bulk delete of the selected rows ended: every one is gone, or it failed (perhaps
 * partway) with a message that is safe to show and, when the server answered, its HTTP status.
 * Either way `deleted` is how many records were deleted; those are no longer selected, and the
 * rest still are.
 */
export type BulkDeleteResult =
	{ ok: true; deleted: number } | ({ ok: false; deleted: number } & DeleteFailure);

/** One choice of a list View's filter control: a checkbox or a radio button. */
export type FilterOption = {
	/** The value the control sends for it, as the list URL writes it. Empty for "Any". */
	value: string;
	label: string;
	/** Whether the list is filtered by it now. */
	checked: boolean;
};

/**
 * The filter control of one filterable Field, in a list View's filter form. Its inputs are named
 * by the Field's key, as the list URL names the filter.
 *
 * - `checkboxes`: one per option, any number of them checked, for an enum Field that allows
 *   `in`. One checked option filters with `eq`, several with `in`, none not at all.
 * - `radio`: one of the options, the first of which is "Any" (no filter, an empty value), for a
 *   boolean Field (Any / Yes / No) or an enum Field that allows only `eq`. It filters with `eq`.
 */
export type FilterControl = {
	field: Field;
	type: 'checkboxes' | 'radio';
	/** The name of each of its inputs. */
	name: string;
	options: FilterOption[];
};

/**
 * The headless list View: the Fields to show, the list params in the URL, the query to await,
 * the hrefs that change page, page size and sort, each record's href, the search box's state, and
 * the filter controls and form.
 * The Theme's list View is built on it, and so can a replaced View. It takes the Resource as an
 * argument, not from context.
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
 * const view = createListView(recipes, remote);
 * const result = $derived(await view.query);
 */
export function createListView<R extends Resource>(
	resource: R,
	remote: ResourceRemote<RecordOf<R>, IdOf<R>, ListParams<R>>
) {
	// Kit 3 types `page.url` as a read-only URL, so the helpers take a plain copy. Nothing mutates
	// it: a new copy is derived whenever `page.url` changes.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- never mutated
	const url = $derived(new URL(page.url.href));
	const params = $derived(readListParams(url, resource));
	/** The href of this list with `next` params, leaving out the Resource's defaults. */
	const hrefOf = (next: ListParams) => listHref(url, next, resource);
	const fields = resource.fields.filter((field) => field.list);
	// The stock page sizes, with the Resource's own in its place among them.
	const perPageOptions: readonly number[] = PER_PAGE_OPTIONS.includes(resource.perPage)
		? PER_PAGE_OPTIONS
		: [...PER_PAGE_OPTIONS, resource.perPage].sort((a, b) => a - b);
	// The Fields that name a record, as the Record title tries them, then the id.
	const linkField =
		[...titleKeys(resource), 'id']
			.map((key) => fields.find((field) => field.key === key))
			.find(Boolean) ?? fields[0];

	$effect(() => {
		const rewrite = listUrlRewrite(url, resource);
		// The rewrite only cleans the URL the page was opened with, so keep scroll and focus.
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the current list path
		if (rewrite !== undefined) void goto(rewrite, { replace: true, reset: false });
	});

	// Search text typed but not yet in the URL, or `undefined` while the URL holds what was typed.
	// While it is set the search box shows it, so a navigation that lands after more typing never
	// rewinds the text.
	let draft = $state<string | undefined>();
	let debounce: ReturnType<typeof setTimeout> | undefined;
	// The list href a search last navigated to, and the one the URL held when last checked.
	// Untracked, so the caller's `$derived` doesn't follow the URL.
	let searchHref: string | undefined;
	let currentHref = untrack(() => hrefOf(params));

	$effect(() => {
		const href = hrefOf(params);
		if (href === currentHref) return;
		currentHref = href;
		// Any other navigation (a pager or page-size link, Back) drops a search still waiting to be
		// written, so it can't undo that navigation, and the search box shows the URL's search.
		if (href !== searchHref) {
			clearTimeout(debounce);
			draft = undefined;
		}
	});
	// Leaving the list (or switching Resource) drops a search that was still waiting.
	$effect(() => () => clearTimeout(debounce));

	// The search and the sort in the URL, if any. Read through the loose `ListParams`, since a
	// Resource that isn't searchable has no `search` in its own, and one with no sortable Field no
	// `sort`.
	const looseParams = $derived(params satisfies ListParams as ListParams);
	const urlSearch = $derived(looseParams.search);
	const filterCount = $derived(looseParams.filters?.length ?? 0);
	const searchText = () => draft ?? urlSearch ?? '';

	const selection = createSelection<IdOf<R>>();

	/** The values the list is filtered by a Field with, by `eq` or `in`, as the URL writes them. */
	function filteredValues(key: string): string[] {
		const values: FilterValue[] = [];
		for (const filter of looseParams.filters ?? []) {
			if (filter.field !== key) continue;
			if (filter.operator === 'eq') values.push(filter.value);
			if (filter.operator === 'in') values.push(...filter.value);
		}
		return values.map(String);
	}

	/** The filter control of a filterable Field, or `undefined` when no stock control fits it. */
	function filterControl(field: Field): FilterControl | undefined {
		const values = filteredValues(field.key);
		const option = (value: string, label: string): FilterOption => ({
			value,
			label,
			checked: value === '' ? values.length === 0 : values.includes(value)
		});
		const radio = (options: FilterOption[]): FilterControl => ({
			field,
			type: 'radio',
			name: field.key,
			options: [option('', 'Any'), ...options]
		});
		if (field.kind === 'boolean') return radio([option('true', 'Yes'), option('false', 'No')]);
		if (field.kind !== 'enum') return undefined;
		const options = field.options.map((value) => option(String(value), String(value)));
		if (field.filterOperators.includes('in')) {
			return { field, type: 'checkboxes', name: field.key, options };
		}
		return radio(options);
	}

	function sortState(key: SortableKey<R>): SortOrder | undefined {
		const sort = looseParams.sort;
		return sort?.field === key ? sort.order : undefined;
	}

	/** Write a search to the URL now, in place, at page 1 of the current page size. */
	function writeSearch(text: string) {
		clearTimeout(debounce);
		const href = hrefOf({ ...params, page: 1, search: text });
		if (href === hrefOf(params)) {
			draft = undefined;
			return;
		}
		searchHref = href;
		// Keep focus in the search box and the scroll where it is.
		void goto(href, { replace: true, reset: false }).finally(() => {
			if (draft === text) draft = undefined;
		});
	}

	return {
		resource,
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
			return `${url.pathname}/${CREATE_SEGMENT}`;
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
			return sortState(key);
		},
		/**
		 * The href that sorts the list by a sortable Field, for its column header: ascending, then
		 * descending once it is sorted ascending, then back to the Resource's default sort (or no
		 * sort, without one) once it is sorted descending. The default sort's own Field toggles
		 * between the two orders instead, so the list is never left unsorted. It starts again at
		 * page 1 and keeps the search, the filters and the page size.
		 */
		sortHref(key: SortableKey<R>): string {
			const { perPage, search, filters } = looseParams;
			const order = sortState(key);
			if (order === 'desc' && key !== resource.defaultSort?.field) {
				return hrefOf({ page: 1, perPage, search, filters });
			}
			const next: SortOrder = order === 'asc' ? 'desc' : 'asc';
			return hrefOf({ page: 1, perPage, search, filters, sort: { field: key, order: next } });
		},
		/**
		 * The page sizes to offer, as plain links, smallest first: 10, 25, 50 and 100, plus the
		 * Resource's own `perPage` when it isn't one of them.
		 */
		perPageOptions,
		/** The href of another page, at the same page size. */
		pageHref(target: number): string {
			return hrefOf({ ...params, page: target });
		},
		/** The href of the first page at another page size, keeping the search, sort and filters. */
		perPageHref(perPage: number): string {
			return hrefOf({ ...params, page: 1, perPage });
		},
		/** Whether to offer a search box: only on a searchable Resource. */
		searchable: resource.searchable,
		/** The text for the search box: what is being typed, else the search in the URL. */
		get search(): string {
			return searchText();
		},
		/** Take what was typed in the search box. It reaches the URL once typing pauses. */
		setSearch(text: string) {
			draft = text;
			clearTimeout(debounce);
			debounce = setTimeout(() => writeSearch(text), SEARCH_DEBOUNCE_MS);
		},
		/** Write the search box's text to the URL now, e.g. when its form is submitted. */
		submitSearch() {
			writeSearch(searchText());
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
				return { ok: false, deleted: 0, ...readDeleteFailure(failure, BULK_DELETE_FAILED) };
			}
			// The deleted ids are the first ones sent, in order.
			selection.setAll(ids.slice(0, report.deleted), false);
			return 'failure' in report
				? { ok: false, deleted: report.deleted, ...report.failure }
				: { ok: true, deleted: report.deleted };
		},
		/**
		 * The GET form the search box sits in, so search works without JavaScript too: where it
		 * goes, the name of its search box, and the params it keeps as hidden inputs (a page size
		 * and a sort that aren't the Resource's defaults, and the filters, never the page). The form
		 * names no empty param.
		 */
		get searchForm(): { action: string; name: 'q'; hidden: [name: string, value: string][] } {
			const { perPage, sort, filters } = looseParams;
			return { ...keptForm({ page: 1, perPage, sort, filters }), name: 'q' };
		},
		/**
		 * The filter controls to offer: one per filterable Field that isn't hidden, in schema order,
		 * for the Fields a stock control fits (an enum, a boolean). Filters on other Fields, and with
		 * operators no control offers, still work from the URL.
		 */
		get filterControls(): FilterControl[] {
			return resource.fields
				.filter((field) => field.detail && field.filterOperators.length > 0)
				.map(filterControl)
				.filter((control) => control !== undefined);
		},
		/** How many filters the list is filtered by now. */
		get filterCount(): number {
			return filterCount;
		},
		/**
		 * The GET form the filter controls sit in, so filters work without JavaScript too: where it
		 * goes, and the params it keeps as hidden inputs (the search, and a sort and a page size
		 * that aren't the Resource's defaults, never the page, so it starts again at page 1).
		 * Without JavaScript it sends its empty controls too, which the list URL ignores; with it,
		 * submit through `applyFilters`, which leaves them out.
		 */
		get filterForm(): { action: string; hidden: [name: string, value: string][] } {
			const { perPage, sort, search } = looseParams;
			return keptForm({ page: 1, perPage, sort, search });
		},
		/** The href of the list with no filters, at page 1, keeping the search, sort and page size. */
		get clearFiltersHref(): string {
			return hrefOf({ ...looseParams, page: 1, filters: undefined });
		},
		/**
		 * Filter the list by what the filter form holds (its controls and hidden inputs): go to the
		 * clean href it names, with no empty param, at page 1. A navigation that adds a history
		 * entry, so Back undoes it; the scroll and focus stay where they are.
		 */
		applyFilters(formData: FormData): Promise<void> {
			const entries = [...formData].filter(
				(entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== ''
			);
			// eslint-disable-next-line svelte/prefer-svelte-reactivity -- never mutated
			const target = new URL(`${url.pathname}?${new URLSearchParams(entries)}`, url);
			const next = { ...readListParams(target, resource), page: 1 };
			return goto(hrefOf(next), { reset: false });
		}
	};

	/** A GET form's action and the hidden inputs that keep `kept`, leaving out their defaults. */
	function keptForm(kept: ListParams): { action: string; hidden: [name: string, value: string][] } {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- never mutated
		const target = new URL(hrefOf(kept), url);
		return { action: target.pathname, hidden: [...target.searchParams] };
	}
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

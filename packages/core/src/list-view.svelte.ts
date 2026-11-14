import { goto } from '$app/navigation';
import { page } from '$app/state';
import { untrack } from 'svelte';
import { hasPathSegment, idPathSegment } from './ids.ts';
import type { ListParams } from './provider.ts';
import { listHref, listUrlRewrite, readListParams } from './list-url.ts';
import { TITLE_KEYS } from './record-title.ts';
import type { ResourceRemote } from './remote.ts';
import type { IdOf, RecordOf, Resource } from './resource.ts';

/** The page sizes a list View offers. Any size from 1 to the cap still works from the URL. */
const PER_PAGE_OPTIONS: readonly number[] = [10, 25, 50, 100];

/** How long typing must pause before a search is written to the URL. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The headless list View: the Fields to show, the list params in the URL, the query to await,
 * the hrefs that change page and page size, each record's href, and the search box's state.
 * The Theme's list View is built on it, and so can a replaced View. It takes the Resource as an
 * argument, not from context.
 *
 * The URL holds the list params. A bad value or an unknown param in it is dropped, and with
 * JavaScript the URL is rewritten in place (`replace`, so no history entry is added). On a
 * searchable Resource, typing a search writes it to the URL after a short pause, also in place,
 * and starts again at page 1. Until then the typed text is the only state outside the URL.
 *
 * Call it during component setup. In a component whose Resource can change, wrap the call in
 * `$derived`, so the list View follows the Resource.
 *
 * @example
 * const view = createListView(recipes, remote);
 * const result = $derived(await view.query);
 */
export function createListView<R extends Resource>(
	resource: R,
	remote: ResourceRemote<RecordOf<R>, IdOf<R>>
) {
	// Kit 3 types `page.url` as a read-only URL, so the helpers take a plain copy. Nothing mutates
	// it: a new copy is derived whenever `page.url` changes.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- never mutated
	const url = $derived(new URL(page.url.href));
	const params = $derived(readListParams(url, resource));
	const fields = resource.fields.filter((field) => field.list);
	// The Fields that name a record (as the Record title's rule tries them), then the id.
	const linkField =
		[...TITLE_KEYS, 'id'].map((key) => fields.find((field) => field.key === key)).find(Boolean) ??
		fields[0];

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
	let currentHref = untrack(() => listHref(url, params));

	$effect(() => {
		const href = listHref(url, params);
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

	const searchText = () => draft ?? params.search ?? '';

	/** Write a search to the URL now, in place, at page 1 of the current page size. */
	function writeSearch(text: string) {
		clearTimeout(debounce);
		const href = listHref(url, { page: 1, perPage: params.perPage, search: text });
		if (href === listHref(url, params)) {
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
		/** The page, page size and search in the URL, with defaults for what it leaves out. */
		get params(): ListParams {
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
		 * The Field whose cell links each row to its record's detail View: `name`, else `title`,
		 * else the id, else the first Field shown, whichever the list shows first.
		 */
		linkField,
		/**
		 * The href of a record's detail View, under the list's own path, so it carries the admin's
		 * base path. The id is one path segment. `undefined` for the rare id no URL can hold as one
		 * segment (empty, `.` or `..`): that record has no detail View link.
		 */
		recordHref(record: RecordOf<R>): string | undefined {
			const id = (record as { id: IdOf<R> }).id;
			return hasPathSegment(id) ? `${url.pathname}/${idPathSegment(id)}` : undefined;
		},
		/** The page sizes to offer, as plain links. */
		perPageOptions: PER_PAGE_OPTIONS,
		/** The href of another page, at the same page size. */
		pageHref(target: number): string {
			return listHref(url, { ...params, page: target });
		},
		/** The href of the first page at another page size, keeping the search. */
		perPageHref(perPage: number): string {
			return listHref(url, { page: 1, perPage, search: params.search });
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
		/**
		 * The GET form the search box sits in, so search works without JavaScript too: where it
		 * goes, the name of its search box, and the params it keeps as hidden inputs (a page size
		 * that isn't the default, never the page). The form names no empty param.
		 */
		get searchForm(): { action: string; name: 'q'; hidden: [name: string, value: string][] } {
			// eslint-disable-next-line svelte/prefer-svelte-reactivity -- never mutated
			const kept = new URL(listHref(url, { page: 1, perPage: params.perPage }), url);
			return { action: kept.pathname, name: 'q', hidden: [...kept.searchParams] };
		}
	};
}

/** What `createListView` returns. */
export type ListViewState<R extends Resource = Resource> = ReturnType<typeof createListView<R>>;

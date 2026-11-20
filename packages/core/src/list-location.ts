import { listHref, readListParams, type ListUrlResource } from './list-url.ts';
import type { ListParams, SortableKey, SortOrder } from './provider.ts';

/** How long typing must pause before a search is written to the URL. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * The list location's port to the router. Every href is a path and a query, as a list link
 * writes it (`/admin/recipes?page=2`).
 *
 * Kit's adapter (`createKitListRouter`) serves the list View helper, and an in-memory one
 * (`createMemoryListRouter`) the list location's tests.
 */
export type ListRouter = {
	/** The href of the URL the list shows now. */
	current(): string;
	/**
	 * The href of a navigation in flight, which the list doesn't show yet: one still loading, or
	 * one the address bar shows already. `undefined` when there is none.
	 */
	pending(): string | undefined;
	/**
	 * Go to `href`, replacing the history entry or adding one, keeping the scroll and the focus.
	 * Settles once the navigation ends: it landed, or a newer one replaced it.
	 */
	navigate(href: string, options: { replace: boolean }): Promise<void>;
};

/** Any origin: an href is a path and a query, and only those are read. */
const BASE = 'http://list.invalid';

/**
 * A list's location: the list params in its URL, the hrefs of the pager and the sort headers,
 * and the search being typed, which it writes to the URL once typing pauses. It is the one place
 * that navigates for the search.
 *
 * Its rule is "latest intent wins". A search waits out a short pause, and a navigation the
 * person starts meanwhile (a pager or sort link, Back) cancels it, whether that navigation is
 * still loading or has landed; the search box then shows that URL's search. Typing again starts
 * a fresh search, from where the list is going. A search the URL already holds navigates nowhere.
 *
 * It reads the router through `ListRouter` only, so the rule is tested without Kit. It holds no
 * reactive state: `onChange` is called whenever the search text changes for a reason other than
 * the URL, so a View can render it again.
 *
 * Call `dispose` when the list goes away, so a waiting search is dropped.
 */
export function createListLocation<R extends ListUrlResource>(
	resource: R,
	router: ListRouter,
	{ onChange = () => {} }: { onChange?: () => void } = {}
) {
	let debounce: ReturnType<typeof setTimeout> | undefined;
	// The text typed but not yet in the URL, and where the list was going when it was typed. While
	// it is set the search box shows it, so a navigation that lands after more typing never
	// rewinds the text.
	let draft: { text: string; typedAt: string } | undefined;
	// The href the last search navigated to, so its own navigation never cancels a later search.
	let searchHref: string | undefined;

	const paramsAt = (href: string): ListParams<R> => readListParams(new URL(href, BASE), resource);
	/** The href of the list at `href`'s path with `next` params, leaving out the defaults. */
	const hrefAt = (href: string, next: ListParams) => listHref(new URL(href, BASE), next, resource);
	/** Where the list is going: a navigation in flight, else the URL it shows. */
	const latest = () => router.pending() ?? router.current();
	/** The params now, read through the loose `ListParams`, which has every param. */
	const looseParams = (): ListParams => paramsAt(router.current());

	/** Whether a navigation other than the search's own started since the draft was typed. */
	function superseded(): boolean {
		if (draft === undefined) return false;
		const heading = latest();
		return heading !== draft.typedAt && heading !== searchHref;
	}

	function dropDraft() {
		clearTimeout(debounce);
		draft = undefined;
	}

	/** Write a search to the URL now, in place, at page 1, from where the list is going. */
	function writeSearch(text: string) {
		clearTimeout(debounce);
		const base = latest();
		const params = paramsAt(base);
		const href = hrefAt(base, { ...params, page: 1, search: text });
		if (href === hrefAt(base, params)) {
			draft = undefined;
			onChange();
			return;
		}
		searchHref = href;
		void router.navigate(href, { replace: true }).finally(() => {
			if (draft?.text !== text) return;
			draft = undefined;
			onChange();
		});
	}

	function searchText(): string {
		// Reading it is when a superseded draft is noticed, as well as when its pause ends: the
		// search box reads it each time the URL changes.
		if (superseded()) dropDraft();
		return draft?.text ?? looseParams().search ?? '';
	}

	function sortState(key: SortableKey<R>): SortOrder | undefined {
		const sort = looseParams().sort;
		return sort?.field === key ? sort.order : undefined;
	}

	return {
		/** The list params in the URL the list shows, with defaults for what it leaves out. */
		get params(): ListParams<R> {
			return paramsAt(router.current());
		},
		/** The href of this list with `next` params, leaving out the Resource's defaults. */
		href(next: ListParams): string {
			return hrefAt(router.current(), next);
		},
		/** The href of another page, at the same page size. */
		pageHref(target: number): string {
			return hrefAt(router.current(), { ...looseParams(), page: target });
		},
		/** The href of the first page at another page size, keeping the search, sort and filters. */
		perPageHref(perPage: number): string {
			return hrefAt(router.current(), { ...looseParams(), page: 1, perPage });
		},
		/** The order the list is sorted by a Field in, or `undefined`. See the list View's. */
		sortState(key: SortableKey<R>): SortOrder | undefined {
			return sortState(key);
		},
		/**
		 * The href that sorts the list by a sortable Field: ascending, then descending, then back to
		 * the default sort. The default sort's own Field toggles between its two orders. It starts
		 * again at page 1 and keeps the search, the filters and the page size.
		 */
		sortHref(key: SortableKey<R>): string {
			const { perPage, search, filters } = looseParams();
			const order = sortState(key);
			if (order === 'desc' && key !== resource.defaultSort?.field) {
				return hrefAt(router.current(), { page: 1, perPage, search, filters });
			}
			const next: SortOrder = order === 'asc' ? 'desc' : 'asc';
			const sort = { field: key, order: next };
			return hrefAt(router.current(), { page: 1, perPage, search, filters, sort });
		},
		/** The text for the search box: what is being typed, else the search in the URL. */
		get search(): string {
			return searchText();
		},
		/** Take what was typed in the search box. It reaches the URL once typing pauses. */
		setSearch(text: string) {
			clearTimeout(debounce);
			draft = { text, typedAt: latest() };
			onChange();
			debounce = setTimeout(() => {
				if (superseded()) dropDraft();
				else writeSearch(text);
			}, SEARCH_DEBOUNCE_MS);
		},
		/** Write the search box's text to the URL now, e.g. when its form is submitted. */
		submitSearch() {
			writeSearch(searchText());
		},
		/** Drop a search still waiting to be written, e.g. when the list goes away. */
		dispose() {
			dropDraft();
		}
	};
}

/** What `createListLocation` returns. */
export type ListLocation<R extends ListUrlResource = ListUrlResource> = ReturnType<
	typeof createListLocation<R>
>;

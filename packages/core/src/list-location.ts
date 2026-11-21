import { listHref, listUrlRewrite, readListParams, type ListUrlResource } from './list-url.ts';
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
 * A list's location: the URL the list shows and the list params in it, the hrefs of the pager
 * and the sort headers, the search being typed, which it writes to the URL once typing pauses,
 * the URL cleanup, and the filter form. It is the one place that navigates for the list.
 *
 * Its rule is "latest intent wins":
 *
 * - A search waits out a short pause, and a navigation the person starts meanwhile (a pager or
 *   sort link, Back, applying filters) cancels it, whether that navigation is still loading or
 *   has landed; the search box then shows that URL's search. Typing again starts a fresh search,
 *   from where the list is going. A search the URL already holds navigates nowhere.
 * - The URL cleanup rewrites a URL with bad or unknown params to its clean form, in place. It
 *   waits until the list is `ready` to navigate, and skips the rewrite when any navigation has
 *   started or landed meanwhile, so it never undoes one. A search still waiting goes on from the
 *   clean URL.
 * - Applying filters adds a history entry, at page 1, and cancels a search still waiting or
 *   loading.
 *
 * It reads the router through `ListRouter` only, so the rule is tested without Kit. It holds no
 * reactive state: `onChange` is called whenever the search being typed is taken, written or
 * dropped, so a View reads the search text again.
 *
 * Call `dispose` when the list goes away, so a waiting search or cleanup is dropped.
 */
export function createListLocation<R extends ListUrlResource>(
	resource: R,
	router: ListRouter,
	{
		onChange = () => {},
		ready = () => Promise.resolve()
	}: {
		onChange?: () => void;
		/**
		 * Settles once the list can navigate, which the URL cleanup waits for: e.g. once the page
		 * has hydrated. Called only when the URL needs cleaning. By default, at once.
		 */
		ready?: () => Promise<unknown>;
	} = {}
) {
	let debounce: ReturnType<typeof setTimeout> | undefined;
	// Counts the cleanups asked for, so a newer one, or `dispose`, drops one still waiting.
	let cleanups = 0;
	// The text typed but not yet in the URL, and where the list was going when it was typed. While
	// it is set the search box shows it, so a navigation that lands after more typing never
	// rewinds the text.
	let draft: { text: string; typedAt: string } | undefined;
	// The href of the search navigation in flight, so it never cancels the search box's text.
	let searchHref: string | undefined;

	const paramsAt = (href: string): ListParams<R> => readListParams(new URL(href, BASE), resource);
	/** The href of the list at `href`'s path with `next` params, leaving out the defaults. */
	const hrefAt = (href: string, next: ListParams) => listHref(new URL(href, BASE), next, resource);
	/** Where the list is going: a navigation in flight, else the URL it shows. */
	const goingTo = () => router.pending() ?? router.current();
	/** The params now, read through the loose `ListParams`, which has every param. */
	const looseParams = (): ListParams => paramsAt(router.current());

	/** Whether a navigation other than the search's own started since the draft was typed. */
	function superseded(): boolean {
		if (draft === undefined) return false;
		const target = goingTo();
		return target !== draft.typedAt && target !== searchHref;
	}

	function dropDraft() {
		clearTimeout(debounce);
		draft = undefined;
	}

	/** Write a search to the URL now, in place, at page 1, from where the list is going. */
	function writeSearch(text: string) {
		clearTimeout(debounce);
		const base = goingTo();
		const params = paramsAt(base);
		const href = hrefAt(base, { ...params, page: 1, search: text });
		if (href === hrefAt(base, params)) {
			draft = undefined;
			onChange();
			return;
		}
		searchHref = href;
		void router.navigate(href, { replace: true }).finally(() => {
			// Once it ends, a navigation back to its href is the person's, like any other.
			if (searchHref === href) searchHref = undefined;
			if (draft?.text !== text) return;
			draft = undefined;
			onChange();
		});
	}

	/**
	 * The search box's text: the draft, else the search of where the list is going, so that
	 * submitting it while a pager navigation loads navigates nowhere.
	 */
	function searchText(): string {
		// Reading it is one place a superseded draft is noticed, beside the end of its pause: the
		// search box reads it each time the URL changes or a navigation starts.
		if (superseded()) dropDraft();
		return draft?.text ?? (paramsAt(goingTo()) as ListParams).search ?? '';
	}

	function sortState(key: SortableKey<R>): SortOrder | undefined {
		const sort = looseParams().sort;
		return sort?.field === key ? sort.order : undefined;
	}

	return {
		/**
		 * The URL the list shows. Only its path and query mean anything: its origin is a placeholder,
		 * since the router gives hrefs.
		 */
		get url(): URL {
			return new URL(router.current(), BASE);
		},
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
			const kept: ListParams = { page: 1, perPage, search, filters };
			const order = sortState(key);
			if (order === 'desc' && key !== resource.defaultSort?.field) {
				return hrefAt(router.current(), kept);
			}
			const next: SortOrder = order === 'asc' ? 'desc' : 'asc';
			return hrefAt(router.current(), { ...kept, sort: { field: key, order: next } });
		},
		/**
		 * The text for the search box: what is being typed, else the search in the URL the list is
		 * going to (the one it shows, while no navigation is in flight).
		 */
		get search(): string {
			return searchText();
		},
		/** Take what was typed in the search box. It reaches the URL once typing pauses. */
		setSearch(text: string) {
			clearTimeout(debounce);
			draft = { text, typedAt: goingTo() };
			onChange();
			debounce = setTimeout(() => {
				if (!superseded()) return writeSearch(text);
				dropDraft();
				onChange();
			}, SEARCH_DEBOUNCE_MS);
		},
		/**
		 * Write the search box's text to the URL now, e.g. when its form is submitted. With nothing
		 * newly typed it navigates nowhere while a navigation is in flight, which holds the URL's
		 * search already, so it never undoes a pager or sort click that is still loading.
		 */
		submitSearch() {
			if (superseded()) dropDraft();
			if (draft === undefined && router.pending() !== undefined) return;
			writeSearch(searchText());
		},
		/**
		 * Rewrite the URL the list shows to its clean form (see `listUrlRewrite`), in place, when it
		 * has bad or unknown params, once the list is `ready`. A navigation in flight, or one that
		 * starts or lands before then, skips it, as does a newer cleanup or `dispose`. Call it each
		 * time the URL changes. Resolves once the rewrite has started, or been skipped.
		 */
		async cleanUp(): Promise<void> {
			const cleanup = ++cleanups;
			if (router.pending() !== undefined) return;
			const from = router.current();
			const rewrite = listUrlRewrite(new URL(from, BASE), resource);
			if (rewrite === undefined) return;
			await ready().catch(() => {});
			if (cleanup !== cleanups || goingTo() !== from) return;
			// The clean URL is the same list, so a search still waiting goes on from it.
			if (draft?.typedAt === from) draft.typedAt = rewrite;
			void router.navigate(rewrite, { replace: true });
		},
		/**
		 * Filter the list by what a filter form holds (its controls and its hidden inputs, which keep
		 * the search, the sort and the page size): go to the clean href it names, at page 1, from
		 * the list's path, with no empty param. It adds a history entry, so Back undoes it.
		 *
		 * It is the person's newest intent, so it cancels a search still waiting or loading; the
		 * list keeps the search the form holds, which is the URL's.
		 */
		applyFilters(formData: FormData): Promise<void> {
			if (draft !== undefined) {
				dropDraft();
				onChange();
			}
			const entries = [...formData].filter(
				(entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== ''
			);
			const from = router.current();
			const { pathname } = new URL(from, BASE);
			const next = { ...paramsAt(`${pathname}?${new URLSearchParams(entries)}`), page: 1 };
			return router.navigate(hrefAt(from, next), { replace: false });
		},
		/** Drop a search or a cleanup still waiting, e.g. when the list goes away. */
		dispose() {
			cleanups++;
			dropDraft();
		}
	};
}

/** What `createListLocation` returns. */
export type ListLocation<R extends ListUrlResource = ListUrlResource> = ReturnType<
	typeof createListLocation<R>
>;

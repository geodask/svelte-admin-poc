import { goto } from '$app/navigation';
import { page } from '$app/state';
import type { ListParams } from './provider.ts';
import { listHref, listUrlRewrite, readListParams } from './list-url.ts';
import type { ResourceRemote } from './remote.ts';
import type { RecordOf, Resource } from './resource.ts';

/** The page sizes a list View offers. Any size from 1 to the cap still works from the URL. */
export const PER_PAGE_OPTIONS: readonly number[] = [10, 25, 50, 100];

/**
 * The headless list View: the Fields to show, the list params in the URL, the query to await,
 * and the hrefs that change page and page size. The Theme's list View is built on it, and so
 * can a replaced View. It takes the Resource as an argument, not from context.
 *
 * The URL is the only state. A bad value or an unknown param in it is dropped, and with
 * JavaScript the URL is rewritten in place (`replace`, so no history entry is added).
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
	remote: ResourceRemote<RecordOf<R>>
) {
	// `page.url` is read-only in Kit 3, so the helpers get a URL of their own. Nothing mutates
	// it: a new one is derived whenever `page.url` changes.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- never mutated
	const url = $derived(new URL(page.url.href));
	const params = $derived(readListParams(url));
	const fields = resource.fields.filter((field) => field.list);

	$effect(() => {
		const rewrite = listUrlRewrite(url);
		// The rewrite only cleans the URL the page was opened with, so keep scroll and focus.
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the current list path
		if (rewrite !== undefined) void goto(rewrite, { replace: true, reset: false });
	});

	return {
		resource,
		/** The Fields the list View shows, in schema order. */
		fields,
		/** The page and page size in the URL, with defaults for what it leaves out. */
		get params(): ListParams {
			return params;
		},
		/** The current page of records. Await it: `$derived(await view.query)`. */
		get query() {
			return remote.getList(params);
		},
		/** The page sizes to offer, as plain links. */
		perPageOptions: PER_PAGE_OPTIONS,
		/** The href of another page, at the same page size. */
		pageHref(page: number): string {
			return listHref(url, { ...params, page });
		},
		/** The href of the first page at another page size. */
		perPageHref(perPage: number): string {
			return listHref(url, { page: 1, perPage });
		}
	};
}

/** What `createListView` returns. */
export type ListViewState<R extends Resource = Resource> = ReturnType<typeof createListView<R>>;

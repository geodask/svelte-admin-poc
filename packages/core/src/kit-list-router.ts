import { browser } from '$app/env';
import { goto } from '$app/navigation';
import { navigating, page } from '$app/state';
import type { ListRouter } from './list-location.ts';

/** The path and query of a URL, as a list link writes them. */
const pathAndQuery = (url: { pathname: string; search: string }) => url.pathname + url.search;

/**
 * Kit's adapter of the list location's router port, for the list View helper. It reads Kit's
 * `page` and `navigating`, which are reactive, so a View that reads the list location follows
 * the URL.
 *
 * A navigation is in flight while Kit loads it (`navigating.to`), and also once the address bar
 * shows it but the list doesn't yet: async Svelte holds the list's render while the new page of
 * records loads, so `page.url` can trail the address bar.
 */
export function createKitListRouter(): ListRouter {
	return {
		current: () => pathAndQuery(page.url),
		pending() {
			const to = navigating.to?.url;
			if (to) return pathAndQuery(to);
			if (!browser) return undefined;
			const shown = pathAndQuery(location);
			return shown === pathAndQuery(page.url) ? undefined : shown;
		},
		navigate(href, { replace }) {
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- the current list's path
			return goto(href, { replace, reset: false });
		}
	};
}

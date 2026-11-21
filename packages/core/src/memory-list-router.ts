import type { ListRouter } from './list-location.ts';

/** One navigation the in-memory router was asked for, in the order asked. */
export type MemoryNavigation = { href: string; replace: boolean };

/**
 * The in-memory adapter of the list location's router port, for tests: a history of hrefs and at
 * most one navigation in flight, which lands only when the test says so, as a slow page load
 * would. A newer navigation replaces the one in flight, as Kit's router does.
 *
 * - `navigate` is how the list location navigates (a search, the URL cleanup, applying
 *   filters). It is logged in `navigations`.
 * - `click` is a navigation the person starts with a plain link (a pager or sort link), which
 *   Kit's router handles without the list location.
 * - `land` completes the navigation in flight.
 */
export function createMemoryListRouter(initial: string) {
	const entries = [initial];
	let inFlight: { href: string; replace: boolean; done: () => void } | undefined;
	const navigations: MemoryNavigation[] = [];

	function start(href: string, replace: boolean): Promise<void> {
		// A newer navigation replaces the one in flight, which then ends without landing.
		inFlight?.done();
		return new Promise((resolve) => {
			inFlight = { href, replace, done: resolve };
		});
	}

	const router = {
		current: () => entries[entries.length - 1],
		pending: () => inFlight?.href,
		navigate(href: string, { replace }: { replace: boolean }): Promise<void> {
			navigations.push({ href, replace });
			return start(href, replace);
		},
		/** A plain link the person clicks: a navigation in flight that adds a history entry. */
		click(href: string): void {
			void start(href, false);
		},
		/** Complete the navigation in flight: its href is now the current one. */
		land(): void {
			if (inFlight === undefined) throw new Error('No navigation is in flight.');
			const { href, replace, done } = inFlight;
			inFlight = undefined;
			if (replace) entries[entries.length - 1] = href;
			else entries.push(href);
			done();
		},
		/** The history entries, oldest first; the last is the current one. */
		get entries(): readonly string[] {
			return entries;
		},
		/** Every navigation the list location asked for, in order. */
		navigations: navigations as readonly MemoryNavigation[]
	} satisfies ListRouter & Record<string, unknown>;
	return router;
}

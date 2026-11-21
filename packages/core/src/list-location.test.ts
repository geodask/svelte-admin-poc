import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { defineResource, field } from '@svelte-admin/core';
import { createListLocation, SEARCH_DEBOUNCE_MS, type ListLocation } from './list-location.ts';
import { createMemoryListRouter } from './memory-list-router.ts';

const recipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	searchable: true,
	schema: z.object({
		id: z.number(),
		name: field(z.string(), { sortable: true })
	})
});

/** A list location for recipes over an in-memory router that starts at `href`. */
function setup(href: string) {
	const router = createMemoryListRouter(href);
	const location = createListLocation(recipes, router);
	return { router, location };
}

/** Let typing pause for long enough that a waiting search ends. */
const pause = () => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
});

describe('a search', () => {
	it('reaches the URL in place once typing pauses, at page 1, keeping the page size', () => {
		const { router, location } = setup('/admin/recipes?page=2&perPage=10');

		location.setSearch('chi');
		vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
		expect(router.navigations).toEqual([]);
		location.setSearch('chicken');
		vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
		expect(router.navigations).toEqual([]);
		pause();

		expect(router.navigations).toEqual([
			{ href: '/admin/recipes?perPage=10&q=chicken', replace: true }
		]);
	});
});

describe('the params', () => {
	it('are the current URL’s, with the Resource’s defaults for what it leaves out', () => {
		const { location } = setup('/admin/recipes?page=2&q=pasta&sort=name&order=desc');

		expect(location.params).toEqual({
			page: 2,
			perPage: 25,
			search: 'pasta',
			sort: { field: 'name', order: 'desc' }
		});
	});

	it('come with the path and query of the URL the list shows', () => {
		const { router, location } = setup('/admin/recipes?page=2');

		router.click('/admin/recipes?page=3');
		expect(location.url.pathname + location.url.search).toBe('/admin/recipes?page=2');
		router.land();

		expect(location.url.pathname + location.url.search).toBe('/admin/recipes?page=3');
	});

	it('follow the URL once a navigation lands, not before', () => {
		const { router, location } = setup('/admin/recipes');

		router.click('/admin/recipes?page=3');
		expect(location.params.page).toBe(1);
		router.land();

		expect(location.params.page).toBe(3);
	});
});

describe('the pager', () => {
	it('links to another page at the same page size, keeping the search and sort', () => {
		const { location } = setup('/admin/recipes?perPage=10&q=pasta&sort=name');

		expect(location.pageHref(3)).toBe('/admin/recipes?page=3&perPage=10&sort=name&q=pasta');
		expect(location.pageHref(1)).toBe('/admin/recipes?perPage=10&sort=name&q=pasta');
	});

	it('links to page 1 of another page size, leaving the Resource’s own out', () => {
		const { location } = setup('/admin/recipes?page=4&perPage=10&q=pasta');

		expect(location.perPageHref(50)).toBe('/admin/recipes?perPage=50&q=pasta');
		expect(location.perPageHref(25)).toBe('/admin/recipes?q=pasta');
	});
});

describe('a sort header', () => {
	const sortedByDefault = defineResource({
		name: 'recipes',
		label: 'Recipes',
		defaultSort: { field: 'createdAt', order: 'desc' },
		schema: z.object({
			id: z.number(),
			name: field(z.string(), { sortable: true }),
			createdAt: field(z.string(), { sortable: true })
		})
	});
	const at = (href: string) => createListLocation(sortedByDefault, createMemoryListRouter(href));

	it('sorts ascending, then descending, then back to the default sort, at page 1', () => {
		expect(at('/admin/recipes?page=2').sortHref('name')).toBe('/admin/recipes?sort=name');
		expect(at('/admin/recipes?sort=name').sortHref('name')).toBe(
			'/admin/recipes?sort=name&order=desc'
		);
		expect(at('/admin/recipes?sort=name&order=desc').sortHref('name')).toBe('/admin/recipes');
	});

	it('toggles the default sort’s own Field between its two orders', () => {
		const location = at('/admin/recipes');
		expect(location.sortState('createdAt')).toBe('desc');
		expect(location.sortHref('createdAt')).toBe('/admin/recipes?sort=createdAt');
		expect(at('/admin/recipes?sort=createdAt').sortHref('createdAt')).toBe('/admin/recipes');
	});

	it('says which order the list is sorted by a Field in', () => {
		const location = at('/admin/recipes?sort=name');

		expect(location.sortState('name')).toBe('asc');
		expect(location.sortState('createdAt')).toBeUndefined();
	});
});

describe('the search text', () => {
	it('is the URL’s search until something is typed', () => {
		const { location } = setup('/admin/recipes?q=pasta');

		expect(location.search).toBe('pasta');
		location.setSearch('');
		expect(location.search).toBe('');
	});

	it('keeps what is typed while an earlier search’s navigation lands', () => {
		const { router, location } = setup('/admin/recipes');

		location.setSearch('pas');
		pause();
		location.setSearch('pasta');
		router.land();
		expect(router.current()).toBe('/admin/recipes?q=pas');
		expect(location.search).toBe('pasta');
		pause();
		router.land();

		expect(router.navigations.map(({ href }) => href)).toEqual([
			'/admin/recipes?q=pas',
			'/admin/recipes?q=pasta'
		]);
		expect(router.entries).toEqual(['/admin/recipes?q=pasta']);
		expect(location.search).toBe('pasta');
	});

	it('tells the caller when typing is taken and when a cancelled search is dropped', () => {
		const router = createMemoryListRouter('/admin/recipes?q=pasta');
		let seen: string | undefined;
		const location: ListLocation<typeof recipes> = createListLocation(recipes, router, {
			onChange: () => {
				seen = location.search;
			}
		});

		location.setSearch('chicken');
		expect(seen).toBe('chicken');
		router.click('/admin/recipes?page=2&q=pasta');
		router.land();
		pause();

		expect(seen).toBe('pasta');
	});
});

describe('latest intent wins', () => {
	it('a search that ends while a pager navigation loads leaves the pager’s page', () => {
		const { router, location } = setup('/admin/recipes');

		location.setSearch('chicken');
		router.click('/admin/recipes?page=2');
		pause();
		router.land();

		expect(router.navigations).toEqual([]);
		expect(router.current()).toBe('/admin/recipes?page=2');
		expect(location.search).toBe('');
	});

	it('a pager click while a search waits cancels the search', () => {
		const { router, location } = setup('/admin/recipes');

		location.setSearch('chicken');
		expect(location.search).toBe('chicken');
		router.click('/admin/recipes?page=2');
		router.land();
		expect(location.search).toBe('');
		pause();

		expect(router.navigations).toEqual([]);
		expect(router.entries).toEqual(['/admin/recipes', '/admin/recipes?page=2']);
	});

	it('Back to where the search was typed doesn’t bring the cancelled search back', () => {
		const { router, location } = setup('/admin/recipes');

		location.setSearch('chicken');
		router.click('/admin/recipes?page=2');
		expect(location.search).toBe('');
		// Back before the search's pause ends: the list is where the search was typed again.
		router.click('/admin/recipes');
		router.land();
		pause();

		expect(router.navigations).toEqual([]);
		expect(location.search).toBe('');
	});

	it('typing after a navigation starts a fresh search from the new params', () => {
		const { router, location } = setup('/admin/recipes');

		location.setSearch('chi');
		router.click('/admin/recipes?perPage=10&sort=name');
		router.land();
		pause();
		location.setSearch('pasta');
		pause();

		expect(router.navigations).toEqual([
			{ href: '/admin/recipes?perPage=10&sort=name&q=pasta', replace: true }
		]);
	});

	it('typing while a pager navigation loads searches from where it is going', () => {
		const { router, location } = setup('/admin/recipes');

		router.click('/admin/recipes?perPage=10');
		location.setSearch('pasta');
		pause();

		expect(router.navigations).toEqual([
			{ href: '/admin/recipes?perPage=10&q=pasta', replace: true }
		]);
	});

	it('a pager click while the search’s own navigation loads wins', () => {
		const { router, location } = setup('/admin/recipes');

		location.setSearch('pasta');
		pause();
		router.click('/admin/recipes?page=2');
		router.land();

		expect(router.entries).toEqual(['/admin/recipes', '/admin/recipes?page=2']);
		expect(location.search).toBe('');
	});

	it('submitting the search box while a pager navigation loads doesn’t undo it', () => {
		const { router, location } = setup('/admin/recipes');

		location.setSearch('chicken');
		router.click('/admin/recipes?page=2');
		location.submitSearch();
		router.land();

		expect(router.navigations).toEqual([]);
		expect(router.current()).toBe('/admin/recipes?page=2');
	});

	it('Back to an earlier search’s URL cancels a search still waiting', async () => {
		const { router, location } = setup('/admin/recipes');

		location.setSearch('pas');
		pause();
		router.land();
		await vi.advanceTimersByTimeAsync(0);
		router.click('/admin/recipes?page=2&q=pas');
		router.land();
		location.setSearch('past');
		// Back, to the URL the earlier search wrote, before the new search's pause ends.
		router.click('/admin/recipes?q=pas');
		router.land();
		pause();

		expect(router.navigations.map(({ href }) => href)).toEqual(['/admin/recipes?q=pas']);
		expect(location.search).toBe('pas');
	});
});

describe('a search that matches the current URL', () => {
	it('navigates nowhere', () => {
		const { router, location } = setup('/admin/recipes?perPage=10&q=pasta');

		location.setSearch('past');
		location.setSearch('pasta');
		pause();
		location.setSearch('pasta');
		location.submitSearch();

		expect(router.navigations).toEqual([]);
		expect(location.search).toBe('pasta');
	});
});

describe('the URL cleanup', () => {
	it('rewrites a URL with bad or unknown params in place, replacing the history entry', async () => {
		const { router, location } = setup('/admin/recipes?page=abc&foo=1&perPage=10');

		await location.cleanUp();
		router.land();

		expect(router.navigations).toEqual([{ href: '/admin/recipes?perPage=10', replace: true }]);
		expect(router.entries).toEqual(['/admin/recipes?perPage=10']);
	});

	it('waits until the list is ready to navigate', async () => {
		const router = createMemoryListRouter('/admin/recipes?foo=1');
		const ready = Promise.withResolvers<void>();
		const location = createListLocation(recipes, router, { ready: () => ready.promise });

		const cleaned = location.cleanUp();
		await vi.advanceTimersByTimeAsync(0);
		expect(router.navigations).toEqual([]);
		ready.resolve();
		await cleaned;

		expect(router.navigations).toEqual([{ href: '/admin/recipes', replace: true }]);
	});

	it('leaves a clean URL as it is', async () => {
		const { router, location } = setup('/admin/recipes?page=2&q=pasta');

		await location.cleanUp();

		expect(router.navigations).toEqual([]);
	});
});

describe('latest intent wins over the URL cleanup', () => {
	/** A list location whose list is ready once the test says so. */
	function setupWaiting(href: string) {
		const router = createMemoryListRouter(href);
		const ready = Promise.withResolvers<void>();
		const location = createListLocation(recipes, router, { ready: () => ready.promise });
		return { router, location, ready };
	}

	it('a pager click before the rewrite starts keeps the pager’s page', async () => {
		const { router, location, ready } = setupWaiting('/admin/recipes?foo=1');

		const cleaned = location.cleanUp();
		router.click('/admin/recipes?page=2');
		ready.resolve();
		await cleaned;
		router.land();

		expect(router.navigations).toEqual([]);
		expect(router.entries).toEqual(['/admin/recipes?foo=1', '/admin/recipes?page=2']);
	});

	it('a pager click that lands before the rewrite starts keeps the pager’s page', async () => {
		const { router, location, ready } = setupWaiting('/admin/recipes?foo=1');

		const cleaned = location.cleanUp();
		router.click('/admin/recipes?page=2');
		router.land();
		ready.resolve();
		await cleaned;

		expect(router.navigations).toEqual([]);
		expect(router.current()).toBe('/admin/recipes?page=2');
	});

	it('a pager click while the rewrite loads keeps the pager’s page', async () => {
		const { router, location } = setup('/admin/recipes?foo=1');

		await location.cleanUp();
		router.click('/admin/recipes?page=2');
		router.land();

		expect(router.entries).toEqual(['/admin/recipes?foo=1', '/admin/recipes?page=2']);
	});

	it('a newer cleanup replaces one still waiting', async () => {
		const router = createMemoryListRouter('/admin/recipes?foo=1');
		const waits = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
		let calls = 0;
		const location = createListLocation(recipes, router, {
			ready: () => waits[calls++].promise
		});

		const first = location.cleanUp();
		const second = location.cleanUp();
		waits[0].resolve();
		await first;
		expect(router.navigations).toEqual([]);
		waits[1].resolve();
		await second;

		expect(router.navigations).toEqual([{ href: '/admin/recipes', replace: true }]);
	});

	it('a list that goes away drops a cleanup still waiting', async () => {
		const { router, location, ready } = setupWaiting('/admin/recipes?foo=1');

		const cleaned = location.cleanUp();
		location.dispose();
		ready.resolve();
		await cleaned;

		expect(router.navigations).toEqual([]);
	});

	it('a search still waiting survives the rewrite, and searches from the clean URL', async () => {
		const { router, location } = setup('/admin/recipes?foo=1&perPage=10');

		location.setSearch('pasta');
		await location.cleanUp();
		router.land();
		expect(location.search).toBe('pasta');
		pause();

		expect(router.navigations).toEqual([
			{ href: '/admin/recipes?perPage=10', replace: true },
			{ href: '/admin/recipes?perPage=10&q=pasta', replace: true }
		]);
	});

	it('doesn’t start while a navigation is in flight', async () => {
		const { router, location } = setup('/admin/recipes?foo=1');

		router.click('/admin/recipes?page=2&foo=1');
		await location.cleanUp();

		expect(router.navigations).toEqual([]);
	});
});

describe('applying filters', () => {
	const filterable = defineResource({
		name: 'recipes',
		label: 'Recipes',
		searchable: true,
		schema: z.object({
			id: z.number(),
			name: field(z.string(), { sortable: true }),
			difficulty: field(z.enum(['Easy', 'Medium', 'Hard']), { filterable: true }),
			vegetarian: field(z.boolean(), { filterable: true })
		})
	});

	/** What a filter form holds: its controls and its hidden inputs. */
	function formData(entries: [string, string][]) {
		const data = new FormData();
		for (const [name, value] of entries) data.append(name, value);
		return data;
	}

	function setupFilters(href: string) {
		const router = createMemoryListRouter(href);
		const location = createListLocation(filterable, router);
		return { router, location };
	}

	it('starts again at page 1 and adds a history entry, leaving out the empty controls', () => {
		const { router, location } = setupFilters('/admin/recipes?page=3&perPage=10&q=pasta');

		void location.applyFilters(
			formData([
				['perPage', '10'],
				['q', 'pasta'],
				['difficulty', 'Easy'],
				['difficulty', 'Hard'],
				['vegetarian', '']
			])
		);
		router.land();

		expect(router.navigations).toEqual([
			{ href: '/admin/recipes?perPage=10&q=pasta&difficulty=Easy&difficulty=Hard', replace: false }
		]);
		expect(router.entries).toEqual([
			'/admin/recipes?page=3&perPage=10&q=pasta',
			'/admin/recipes?perPage=10&q=pasta&difficulty=Easy&difficulty=Hard'
		]);
	});

	it('cancels a search still waiting, keeping the search the URL had', () => {
		const { router, location } = setupFilters('/admin/recipes?q=pasta');

		location.setSearch('chicken');
		void location.applyFilters(
			formData([
				['q', 'pasta'],
				['vegetarian', 'true']
			])
		);
		expect(location.search).toBe('pasta');
		router.land();
		pause();

		expect(router.navigations).toEqual([
			{ href: '/admin/recipes?q=pasta&vegetarian=true', replace: false }
		]);
		expect(location.search).toBe('pasta');
	});

	it('cancels the search’s own navigation while it loads', () => {
		const { router, location } = setupFilters('/admin/recipes?q=pasta');

		location.setSearch('chicken');
		pause();
		void location.applyFilters(
			formData([
				['q', 'pasta'],
				['vegetarian', 'true']
			])
		);
		router.land();

		expect(router.entries).toEqual([
			'/admin/recipes?q=pasta',
			'/admin/recipes?q=pasta&vegetarian=true'
		]);
		expect(location.search).toBe('pasta');
	});

	it('tells the caller the search box shows the URL’s search again', () => {
		const router = createMemoryListRouter('/admin/recipes?q=pasta');
		let seen: string | undefined;
		const location: ListLocation<typeof filterable> = createListLocation(filterable, router, {
			onChange: () => {
				seen = location.search;
			}
		});

		location.setSearch('chicken');
		void location.applyFilters(formData([['q', 'pasta']]));

		expect(seen).toBe('pasta');
	});
});

describe('a list that goes away', () => {
	it('drops the search still waiting to be written', () => {
		const { router, location } = setup('/admin/recipes');

		location.setSearch('pasta');
		location.dispose();
		pause();

		expect(router.navigations).toEqual([]);
	});
});

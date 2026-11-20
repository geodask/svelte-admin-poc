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

	it('tells the caller each time it changes, so a View can render it', async () => {
		const router = createMemoryListRouter('/admin/recipes');
		const changes: string[] = [];
		const location: ListLocation<typeof recipes> = createListLocation(recipes, router, {
			onChange: () => {
				changes.push(location.search);
			}
		});

		location.setSearch('pasta');
		pause();
		router.land();
		await vi.runAllTimersAsync();

		expect(changes).toEqual(['pasta', 'pasta']);
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

describe('a list that goes away', () => {
	it('drops the search still waiting to be written', () => {
		const { router, location } = setup('/admin/recipes');

		location.setSearch('pasta');
		location.dispose();
		pause();

		expect(router.navigations).toEqual([]);
	});
});

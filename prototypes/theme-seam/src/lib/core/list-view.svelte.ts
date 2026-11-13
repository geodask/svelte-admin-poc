// PROTOTYPE (PER-18) — core, headless. Everything a list View does except markup.
// BOTH seams use this. Under the View-level seam it is the core's whole list API; under the
// Primitive-level seam the core's own ListView.svelte is just its first consumer.
//
// The URL is the state (PER-12, PER-16): ?q=…&sort=-servings&page=2&cuisine=Italian
// Filters are unprefixed. Sort, page and filter changes are plain links and a GET form,
// so a Theme gets the no-JS path for free if it renders them as <a> and <form>.
import { page } from '$app/state';
import { SvelteSet } from 'svelte/reactivity';
import { columnsOf, formatValue, type Column } from './columns';
import type { Resource } from './resource';
import type { ListParams } from './provider';
import type { ResourceRemote } from './serve-resource';

export function createListView(resource: Resource, remote: ResourceRemote, opts = { perPage: 6 }) {
	const columns = columnsOf(resource);
	const filterable = columns.filter((c) => c.filterable);
	const selected = new SvelteSet<number>();

	function params(): ListParams {
		const sp = page.url.searchParams;
		const p: ListParams = {
			page: Math.max(1, Number(sp.get('page') ?? 1) || 1),
			perPage: Number(sp.get('perPage') ?? opts.perPage) || opts.perPage,
			filters: filterable
				.filter((c) => sp.get(c.key))
				.map((c) => ({ field: c.key, value: sp.get(c.key)! }))
		};
		const sort = sp.get('sort');
		if (sort) p.sort = { field: sort.replace(/^-/, ''), dir: sort.startsWith('-') ? 'desc' : 'asc' };
		const q = sp.get('q');
		if (q) p.search = q;
		return p;
	}

	function href(change: Record<string, string | null>, keepPage = false) {
		const u = new URL(page.url.href);
		for (const [k, v] of Object.entries(change)) v === null ? u.searchParams.delete(k) : u.searchParams.set(k, v);
		if (!keepPage) u.searchParams.delete('page');
		return u.pathname + u.search;
	}

	return {
		resource,
		columns,
		filterable,
		get params() {
			return params();
		},
		/** `const result = $derived(await list.query)` */
		get query() {
			return remote.getList(params());
		},
		format: (col: Column, v: unknown) => formatValue(col, v),
		idOf: (r: Record<string, any>) => r[resource.idKey] as number,
		recordHref: (r: Record<string, any>) => `/${resource.name}/${r[resource.idKey]}`,

		// sort: asc → desc → none
		sortOf(key: string) {
			const s = params().sort;
			return s?.field === key ? s.dir : undefined;
		},
		sortHref(key: string) {
			const cur = this.sortOf(key);
			return href({ sort: cur === undefined ? key : cur === 'asc' ? `-${key}` : null });
		},

		pageCount: (total: number) => Math.max(1, Math.ceil(total / params().perPage)),
		pageHref: (n: number) => href({ page: String(n) }, true),

		// the GET form: inputs named q and <field key>; hidden inputs keep sort etc.
		search: () => page.url.searchParams.get('q') ?? '',
		filterValue: (key: string) => page.url.searchParams.get(key) ?? '',
		filterOptions(col: Column) {
			if (col.kind === 'boolean') return [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }];
			return (col.options ?? []).map((o) => ({ value: o, label: o }));
		},
		/** params the GET filter form must carry over (sort, perPage, anything the app added) */
		get keptParams() {
			return [...page.url.searchParams].filter(
				([k]) => k !== 'q' && k !== 'page' && !filterable.some((c) => c.key === k)
			);
		},
		/** Added for Theme A2, whose filters are links, not a form. */
		filterHref: (key: string, value: string | null) => href({ [key]: value }),
		get hasFilters() {
			const p = params();
			return p.filters.length > 0 || !!p.search;
		},
		clearHref: () => href(Object.fromEntries(['q', ...filterable.map((c) => c.key)].map((k) => [k, null]))),

		selection: {
			has: (id: number) => selected.has(id),
			toggle: (id: number) => (selected.has(id) ? selected.delete(id) : selected.add(id)),
			setAll(ids: number[], on: boolean) {
				for (const id of ids) on ? selected.add(id) : selected.delete(id);
			},
			allOf: (ids: number[]) => ids.length > 0 && ids.every((id) => selected.has(id)),
			get size() {
				return selected.size;
			}
		},
		async deleteSelected() {
			await remote.deleteMany([...selected]).updates(remote.getList);
			selected.clear();
		}
	};
}

export type ListView = ReturnType<typeof createListView>;

<!-- PROTOTYPE (PER-18) — Theme A2: filter rail + cards + sort menu. Same core, no table at all. -->
<script lang="ts">
	import { createListView } from '#lib/core/list-view.svelte.ts';
	import type { Resource } from '#lib/core/resource.ts';
	import type { ResourceRemote } from '#lib/core/serve-resource.ts';

	let { resource, remote }: { resource: Resource; remote: ResourceRemote } = $props();
	// svelte-ignore state_referenced_locally
	const list = createListView(resource, remote);
	const result = $derived(await list.query);
	const pages = $derived(list.pageCount(result.total));
	const sortable = list.columns.filter((c) => c.sortable);
	const [title, ...rest] = list.columns;
	let confirming = $state(false);
</script>

<div class="wrap">
	<aside>
		<form method="GET">
			{#each list.keptParams as [k, v]}<input type="hidden" name={k} value={v} />{/each}
			{#each list.filterable as col}{#if list.filterValue(col.key)}<input type="hidden" name={col.key} value={list.filterValue(col.key)} />{/if}{/each}
			<input name="q" value={list.search()} placeholder="Search…" />
		</form>
		{#each list.filterable as col (col.key)}
			<h4>{col.label}</h4>
			<ul>
				<li><a class:on={!list.filterValue(col.key)} href={list.filterHref(col.key, null)}>All</a></li>
				{#each list.filterOptions(col) as o}
					<li><a class:on={list.filterValue(col.key) === o.value} href={list.filterHref(col.key, o.value)}>{o.label}</a></li>
				{/each}
			</ul>
		{/each}
	</aside>

	<section>
		<header>
			<h1>{resource.label} <small>{result.total}</small></h1>
			<span class="sort">Sort:
				{#each sortable as col}
					{@const dir = list.sortOf(col.key)}
					<a class:on={dir} href={list.sortHref(col.key)}>{col.label}{dir === 'asc' ? ' ↑' : dir === 'desc' ? ' ↓' : ''}</a>
				{/each}
			</span>
		</header>

		<div class="grid">
			{#each result.data as row (list.idOf(row))}
				{@const id = list.idOf(row)}
				<article class:picked={list.selection.has(id)}>
					<label class="pick"><input type="checkbox" checked={list.selection.has(id)} onchange={() => list.selection.toggle(id)} /></label>
					<a class="title" href={list.recordHref(row)}>{row[title.key]}</a>
					<dl>
						{#each rest as col}
							{#if col.kind === 'list'}
								<dd class="tags">{#each row[col.key] as string[] as t}<span>#{t}</span>{/each}</dd>
							{:else if col.kind === 'boolean'}
								{#if row[col.key]}<dd class="flag">{col.label}</dd>{/if}
							{:else if row[col.key] !== undefined}
								<dt>{col.label}</dt><dd>{list.format(col, row[col.key])}</dd>
							{/if}
						{/each}
					</dl>
				</article>
			{:else}
				<p class="empty">Nothing here. <a href={list.clearHref()}>Clear filters</a></p>
			{/each}
		</div>

		<footer>
			{#if list.selection.size}
				{#if confirming}
					Really delete {list.selection.size}? <button class="danger" onclick={async () => { await list.deleteSelected(); confirming = false; }}>Yes, delete</button> <button onclick={() => (confirming = false)}>No</button>
				{:else}
					<button onclick={() => (confirming = true)}>Delete {list.selection.size} selected…</button>
				{/if}
			{/if}
			<span class="pager">
				{#if list.params.page > 1}<a href={list.pageHref(list.params.page - 1)}>← Newer</a>{/if}
				Page {list.params.page} of {pages}
				{#if list.params.page < pages}<a href={list.pageHref(list.params.page + 1)}>Older →</a>{/if}
			</span>
		</footer>
	</section>
</div>

<style>
	.wrap { display: grid; grid-template-columns: 200px 1fr; gap: 2rem; font-family: Georgia, serif; color: #2b2118; }
	aside { border-right: 2px solid #e8dcc8; padding-right: 1rem; }
	aside input { width: 100%; padding: 0.4rem 0.6rem; border: 1px solid #cbb994; border-radius: 999px; background: #fffaf0; font: inherit; }
	h4 { margin: 1.2rem 0 0.3rem; text-transform: uppercase; font-size: 11px; letter-spacing: 0.1em; color: #8a7350; }
	ul { list-style: none; margin: 0; padding: 0; }
	li a { display: block; padding: 2px 6px; border-radius: 4px; color: inherit; text-decoration: none; }
	li a.on { background: #8a3b12; color: #fff; }
	header { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 2px solid #e8dcc8; margin-bottom: 1rem; }
	h1 { font-size: 2rem; margin: 0 0 0.5rem; font-style: italic; }
	h1 small { font-size: 1rem; color: #8a7350; font-style: normal; }
	.sort a { margin-left: 0.6rem; color: #8a7350; }
	.sort a.on { color: #8a3b12; font-weight: bold; }
	.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
	article { position: relative; background: #fffaf0; border: 1px solid #e8dcc8; border-radius: 12px; padding: 1rem; box-shadow: 0 2px 0 #e8dcc8; }
	article.picked { outline: 3px solid #8a3b12; }
	.pick { position: absolute; top: 0.6rem; right: 0.6rem; }
	.title { font-size: 1.2rem; color: #8a3b12; font-weight: bold; text-decoration: none; }
	dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 0.6rem; font-size: 13px; margin: 0.6rem 0 0; }
	dt { color: #8a7350; }
	dd { margin: 0; }
	.tags, .flag { grid-column: 1 / -1; }
	.tags span { margin-right: 0.4rem; color: #5c7a3a; }
	.flag { color: #5c7a3a; font-style: italic; }
	footer { display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; }
	.pager { margin-left: auto; display: flex; gap: 1rem; }
	.pager a { color: #8a3b12; }
	button { font: inherit; padding: 0.3rem 0.8rem; border-radius: 999px; border: 1px solid #cbb994; background: #fffaf0; cursor: pointer; }
	.danger { background: #8a3b12; color: #fff; border-color: #8a3b12; }
	.empty { grid-column: 1 / -1; }
</style>

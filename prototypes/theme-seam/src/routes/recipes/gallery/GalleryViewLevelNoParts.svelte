<!-- View-level seam, Theme A2: the Theme exports only whole Views, so the app writes its own
     search, filters and pager on top of createListView, and has to match the Theme's look itself. -->
<script lang="ts">
	import { createListView } from '#lib/core/list-view.svelte.ts';
	import { recipes } from '#lib/recipes.ts';
	import * as remote from '#lib/recipes.remote.ts';

	const list = createListView(recipes, remote);
	const result = $derived(await list.query);
	const pages = $derived(list.pageCount(result.total));
</script>

<div style="font-family: Georgia, serif">
	<h1 style="font-style: italic; font-size: 2rem">Recipe gallery</h1>
	<form method="GET" style="display: flex; gap: .5rem; margin: 1rem 0">
		{#each list.keptParams as [k, v]}<input type="hidden" name={k} value={v} />{/each}
		<input name="q" value={list.search()} placeholder="Search…" style="border: 1px solid #cbb994; border-radius: 999px; padding: .3rem .8rem" />
		{#each list.filterable as col}
			<select name={col.key} value={list.filterValue(col.key)} style="border: 1px solid #cbb994; border-radius: 999px">
				<option value="">{col.label}: any</option>
				{#each list.filterOptions(col) as o}<option value={o.value}>{o.label}</option>{/each}
			</select>
		{/each}
		<button style="border: 1px solid #cbb994; border-radius: 999px; padding: 0 .8rem">Go</button>
	</form>
	<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem">
		{#each result.data as r (r.id)}
			<a href={list.recordHref(r)} style="background: #fffaf0; border: 1px solid #e8dcc8; border-radius: 12px; padding: 1rem; color: #8a3b12">
				<div style="font-size: 2rem">🍲</div><b>{r.name}</b><div style="color: #8a7350">{r.cuisine} · ★ {r.rating}</div>
			</a>
		{/each}
	</div>
	<p style="margin-top: 1rem">
		{#if list.params.page > 1}<a href={list.pageHref(list.params.page - 1)}>← Newer</a>{/if}
		Page {list.params.page} of {pages}
		{#if list.params.page < pages}<a href={list.pageHref(list.params.page + 1)}>Older →</a>{/if}
	</p>
</div>

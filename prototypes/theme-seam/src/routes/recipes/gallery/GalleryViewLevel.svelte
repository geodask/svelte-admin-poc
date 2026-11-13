<!-- View-level seam, Theme A1: the app reuses the Theme's exported parts, writes the body. -->
<script lang="ts">
	import { createListView } from '#lib/core/list-view.svelte.ts';
	import { Toolbar, Pagination, DeleteDialog } from '#lib/themes/view-level-tailwind/index.ts';
	import { recipes } from '#lib/recipes.ts';
	import * as remote from '#lib/recipes.remote.ts';

	const list = createListView(recipes, remote);
	const result = $derived(await list.query);
</script>

<h1 class="mb-4 text-2xl font-semibold">Recipe gallery</h1>
<Toolbar {list} />
<div class="my-4 grid grid-cols-3 gap-4">
	{#each result.data as r (r.id)}
		<a href={list.recordHref(r)} class="rounded-lg border p-4 hover:bg-muted/40">
			<div class="mb-3 grid h-24 place-items-center rounded-md bg-muted text-3xl">🍲</div>
			<div class="font-medium">{r.name}</div>
			<div class="text-sm text-muted-foreground">{r.cuisine} · ★ {r.rating}</div>
		</a>
	{/each}
</div>
<div class="flex justify-between"><DeleteDialog {list} /><Pagination {list} total={result.total} /></div>

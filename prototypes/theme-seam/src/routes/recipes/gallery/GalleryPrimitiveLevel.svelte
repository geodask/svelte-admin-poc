<!-- Primitive-level seam: the app reuses the core's parts and primitives; it matches whichever
     Theme is active without knowing which one it is. -->
<script lang="ts">
	import { createListView } from '#lib/core/list-view.svelte.ts';
	import { Toolbar, Pagination, DeleteDialog, primitives } from '#lib/core/primitive-level/index.ts';
	import { recipes } from '#lib/recipes.ts';
	import * as remote from '#lib/recipes.remote.ts';

	const P = primitives();
	const list = createListView(recipes, remote);
	const result = $derived(await list.query);
</script>

<P.Heading>Recipe gallery</P.Heading>
<div style="margin: 1rem 0"><Toolbar {list} /></div>
<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem">
	{#each result.data as r (r.id)}
		<div style="border: 1px solid #ddd; border-radius: 10px; padding: 1rem">
			<div style="font-size: 2rem">🍲</div>
			<P.Link href={list.recordHref(r)}>{r.name}</P.Link>
			<div><P.Badge>{r.cuisine}</P.Badge> <P.Muted>★ {r.rating}</P.Muted></div>
		</div>
	{/each}
</div>
<div style="display: flex; justify-content: space-between; margin-top: 1rem"><DeleteDialog {list} /><Pagination {list} total={result.total} /></div>

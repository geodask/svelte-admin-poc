<script lang="ts">
	import type { ListView } from '../list-view.svelte.ts';
	import { primitives } from './primitives';
	let { list }: { list: ListView } = $props();
	const P = primitives();
</script>

<form method="GET" class="sa-toolbar">
	{#each list.keptParams as [k, v]}<input type="hidden" name={k} value={v} />{/each}
	<P.Input name="q" value={list.search()} placeholder="Search {list.resource.label.toLowerCase()}…" />
	{#each list.filterable as col (col.key)}
		<P.Select name={col.key} label={col.label} value={list.filterValue(col.key)} options={[{ value: '', label: `${col.label}: any` }, ...list.filterOptions(col)]} />
	{/each}
	<P.Button type="submit" variant="outline">Apply</P.Button>
	{#if list.hasFilters}<P.LinkButton variant="ghost" href={list.clearHref()}>Reset</P.LinkButton>{/if}
</form>

<style>
	.sa-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
</style>

<script lang="ts">
	import type { ListView } from '#lib/core/list-view.svelte.ts';
	let { list }: { list: ListView } = $props();
	const field = 'h-9 rounded-md border bg-background px-3 text-sm';
</script>

<form method="GET" class="flex flex-wrap items-center gap-2">
	{#each list.keptParams as [k, v]}<input type="hidden" name={k} value={v} />{/each}
	<input name="q" value={list.search()} placeholder="Search {list.resource.label.toLowerCase()}…" class="{field} w-64" />
	{#each list.filterable as col (col.key)}
		<select name={col.key} value={list.filterValue(col.key)} aria-label={col.label} class={field}>
			<option value="">{col.label}: any</option>
			{#each list.filterOptions(col) as o}<option value={o.value}>{o.label}</option>{/each}
		</select>
	{/each}
	<button class="h-9 rounded-md border px-3 text-sm font-medium hover:bg-accent">Apply</button>
	{#if list.hasFilters}<a href={list.clearHref()} class="text-sm text-muted-foreground hover:text-foreground">Reset</a>{/if}
</form>

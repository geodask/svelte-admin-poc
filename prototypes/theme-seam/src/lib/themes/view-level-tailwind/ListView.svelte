<!-- PROTOTYPE (PER-18) — Theme A1 owns all of this markup. The core gives it createListView. -->
<script lang="ts">
	import { createListView } from '#lib/core/list-view.svelte.ts';
	import type { Resource } from '#lib/core/resource.ts';
	import type { ResourceRemote } from '#lib/core/serve-resource.ts';
	import Toolbar from './Toolbar.svelte';
	import Pagination from './Pagination.svelte';
	import Cell from './Cell.svelte';
	import DeleteDialog from './DeleteDialog.svelte';

	let { resource, remote }: { resource: Resource; remote: ResourceRemote } = $props();
	// svelte-ignore state_referenced_locally
	const list = createListView(resource, remote);
	const result = $derived(await list.query);
	const ids = $derived(result.data.map(list.idOf));
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold tracking-tight">{resource.label}</h1>
		<a href="/{resource.name}/new" class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">New {resource.singular}</a>
	</div>

	<Toolbar {list} />

	<div class="overflow-hidden rounded-lg border">
		<table class="w-full text-sm">
			<thead class="bg-muted/50 text-muted-foreground">
				<tr>
					<th class="w-10 px-3 py-2">
						<input type="checkbox" aria-label="Select page" checked={list.selection.allOf(ids)} onchange={(e) => list.selection.setAll(ids, e.currentTarget.checked)} />
					</th>
					{#each list.columns as col (col.key)}
						<th class="px-3 py-2 text-left font-medium {col.kind === 'number' ? 'text-right' : ''}">
							{#if col.sortable}
								{@const dir = list.sortOf(col.key)}
								<a href={list.sortHref(col.key)} class="inline-flex items-center gap-1 hover:text-foreground {dir ? 'text-foreground' : ''}">
									{col.label}<span class="text-xs">{dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '↕'}</span>
								</a>
							{:else}{col.label}{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each result.data as row (list.idOf(row))}
					<tr class="border-t hover:bg-muted/40 {list.selection.has(list.idOf(row)) ? 'bg-muted' : ''}">
						<td class="px-3 py-2"><input type="checkbox" aria-label="Select" checked={list.selection.has(list.idOf(row))} onchange={() => list.selection.toggle(list.idOf(row))} /></td>
						{#each list.columns as col, i (col.key)}
							<td class="px-3 py-2 {col.kind === 'number' ? 'text-right tabular-nums' : ''}">
								{#if i === 0}<a class="font-medium underline-offset-4 hover:underline" href={list.recordHref(row)}>{row[col.key]}</a>
								{:else}<Cell {col} value={row[col.key]} {list} />{/if}
							</td>
						{/each}
					</tr>
				{:else}
					<tr><td colspan={list.columns.length + 1} class="px-3 py-10 text-center text-muted-foreground">No {resource.label.toLowerCase()} match.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="flex items-center justify-between">
		<DeleteDialog {list} />
		<Pagination {list} total={result.total} />
	</div>
</div>

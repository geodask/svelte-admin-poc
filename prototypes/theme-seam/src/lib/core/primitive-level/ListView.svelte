<!-- PROTOTYPE (PER-18) — Primitive-level seam: the core owns this markup and layout.
     Every control goes through the Theme's primitives (P.*). -->
<script lang="ts">
	import { createListView } from '../list-view.svelte.ts';
	import type { Resource } from '../resource.ts';
	import type { ResourceRemote } from '../serve-resource.ts';
	import { primitives } from './primitives';
	import Toolbar from './Toolbar.svelte';
	import Pagination from './Pagination.svelte';
	import Cell from './Cell.svelte';
	import DeleteDialog from './DeleteDialog.svelte';

	let { resource, remote }: { resource: Resource; remote: ResourceRemote } = $props();
	const P = primitives();
	// svelte-ignore state_referenced_locally
	const list = createListView(resource, remote);
	const result = $derived(await list.query);
	const ids = $derived(result.data.map(list.idOf));
</script>

<div class="sa-list">
	<div class="sa-list-head">
		<P.Heading>{resource.label}</P.Heading>
		<P.LinkButton href="/{resource.name}/new">New {resource.singular}</P.LinkButton>
	</div>

	<Toolbar {list} />

	<P.Table>
		<thead>
			<tr>
				<P.Th><P.Checkbox label="Select page" checked={list.selection.allOf(ids)} onchange={(on) => list.selection.setAll(ids, on)} /></P.Th>
				{#each list.columns as col (col.key)}
					<P.Th align={col.kind === 'number' ? 'right' : 'left'}>
						{#if col.sortable}
							{@const dir = list.sortOf(col.key)}
							<P.LinkButton variant="ghost" active={!!dir} href={list.sortHref(col.key)}>{col.label} {dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '↕'}</P.LinkButton>
						{:else}{col.label}{/if}
					</P.Th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each result.data as row (list.idOf(row))}
				<tr data-selected={list.selection.has(list.idOf(row)) || undefined}>
					<P.Td><P.Checkbox label="Select" checked={list.selection.has(list.idOf(row))} onchange={() => list.selection.toggle(list.idOf(row))} /></P.Td>
					{#each list.columns as col, i (col.key)}
						<P.Td align={col.kind === 'number' ? 'right' : 'left'}>
							{#if i === 0}<P.Link href={list.recordHref(row)}>{row[col.key]}</P.Link>
							{:else}<Cell {col} value={row[col.key]} {list} />{/if}
						</P.Td>
					{/each}
				</tr>
			{:else}
				<tr><P.Td><P.Muted>No {resource.label.toLowerCase()} match.</P.Muted></P.Td></tr>
			{/each}
		</tbody>
	</P.Table>

	<div class="sa-list-foot">
		<DeleteDialog {list} />
		<Pagination {list} total={result.total} />
	</div>
</div>

<style>
	/* layout only: the core owns structure, the Theme owns look */
	.sa-list { display: grid; gap: 1rem; }
	.sa-list-head, .sa-list-foot { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
</style>

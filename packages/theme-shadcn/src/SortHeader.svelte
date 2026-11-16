<!--
	The column header of one Field in a list View's table. For a sortable Field it is a link to the
	core's `sortHref`, so sorting works without JavaScript: it sorts ascending, then descending,
	then not at all. The sorted column's header shows an arrow for its direction and carries
	`aria-sort`, so a screen reader announces it too. Any other Field's header is plain text.
	A Theme part, exported for a replaced list View: give it the core's `createListView` helper.
-->
<script module lang="ts">
	import type { Field } from '@svelte-admin/core';
	import type { ListViewState } from '@svelte-admin/core/views';

	export type SortHeaderProps = {
		/** The list View helper from the core's `createListView`. */
		view: ListViewState;
		/** The Field the column shows, e.g. one of `view.fields`. */
		field: Field;
		/** How many columns the header spans. */
		colspan?: number;
	};
</script>

<script lang="ts">
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import * as Table from './components/ui/table/index.ts';

	let { view, field, colspan }: SortHeaderProps = $props();

	const order = $derived(field.sortable ? view.sortState(field.key) : undefined);
	const ariaSort = $derived(
		order === 'asc' ? 'ascending' : order === 'desc' ? 'descending' : undefined
	);
</script>

<Table.Head {colspan} aria-sort={ariaSort}>
	{#if field.sortable}
		<a
			href={view.sortHref(field.key)}
			class="-mx-2 inline-flex h-8 items-center gap-1.5 rounded-md px-2 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
		>
			{field.label}
			{#if order === 'asc'}
				<ArrowUpIcon aria-hidden="true" class="size-3.5" />
			{:else if order === 'desc'}
				<ArrowDownIcon aria-hidden="true" class="size-3.5" />
			{:else}
				<ChevronsUpDownIcon aria-hidden="true" class="size-3.5 text-muted-foreground/60" />
			{/if}
		</a>
	{:else}
		{field.label}
	{/if}
</Table.Head>

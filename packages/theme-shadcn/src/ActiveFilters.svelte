<!--
	The active filter chips of a list View: one per filter the list is filtered by, such as
	"Cuisine: Italian", each a link with × to the list without that filter. Removing one starts
	again at page 1 and keeps the search, sort, page size and every other filter. Each chip is a
	plain link, so it works without JavaScript. It renders nothing while no filter is on. The
	toolbar (`Toolbar`) shows it under its row.
	A Theme part, exported for a replaced list View: give it the core's `createListView` helper.
-->
<script module lang="ts">
	import type { ListViewState } from '@svelte-admin/core/views';

	export type ActiveFiltersProps = {
		/** The list View helper from the core's `createListView`. */
		view: ListViewState;
	};
</script>

<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';

	let { view }: ActiveFiltersProps = $props();

	const filters = $derived(view.activeFilters);
</script>

{#if filters.length > 0}
	<ul aria-label="Active filters" class="flex flex-wrap items-center gap-2">
		{#each filters as filter (`${filter.field.key}.${filter.operator}`)}
			<li>
				<a
					href={filter.href}
					class="inline-flex h-7 items-center gap-1 rounded-full border bg-muted ps-3 pe-2 text-sm hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
				>
					<span class="sr-only">Remove filter</span>
					{filter.label}
					<XIcon aria-hidden="true" class="size-3.5 text-muted-foreground" />
				</a>
			</li>
		{/each}
	</ul>
{/if}

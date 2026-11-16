<!--
	The filter panel of a list View: a "Filters" disclosure, with the count of filters on, that
	opens without JavaScript (a native `<details>`). Inside, a GET form with one control per
	filterable Field the core offers one for: a checkbox per option for an enum, and Any / Yes / No
	for a boolean. "Apply" filters the list from page 1 and keeps the search, sort and page size;
	"Clear filters" links to the list without filters. Without JavaScript the form posts its empty
	controls too, which the list URL ignores; with it, the form goes through `applyFilters`, so the
	URL holds no empty params. It renders nothing for a Resource with no filter control.
	A Theme part, exported for a replaced list View: give it the core's `createListView` helper.
-->
<script module lang="ts">
	import type { ListViewState } from '@svelte-admin/core/views';

	export type FilterPanelProps = {
		/** The list View helper from the core's `createListView`. */
		view: ListViewState;
	};
</script>

<script lang="ts">
	import ListFilterIcon from '@lucide/svelte/icons/list-filter';

	let { view }: FilterPanelProps = $props();

	const form = $derived(view.filterForm);
	const controls = $derived(view.filterControls);
</script>

{#if controls.length > 0}
	<details class="relative">
		<summary
			class="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium select-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden"
		>
			<ListFilterIcon aria-hidden="true" class="size-4" />
			Filters
			{#if view.filterCount > 0}
				<span
					class="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground"
				>
					{view.filterCount}
				</span>
			{/if}
		</summary>

		<form
			method="GET"
			action={form.action}
			aria-label="Filters"
			class="absolute top-full left-0 z-20 mt-2 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-4 rounded-md border bg-popover p-4 text-popover-foreground shadow-md"
			onsubmit={(event) => {
				// With JavaScript, apply in place instead, so the URL names no empty param.
				event.preventDefault();
				void view.applyFilters(new FormData(event.currentTarget));
			}}
		>
			{#each form.hidden as [name, value], index (`${name}-${index}`)}
				<input type="hidden" {name} {value} />
			{/each}

			{#each controls as control (control.field.key)}
				<fieldset class="flex flex-col gap-2">
					<legend class="mb-1 text-sm font-medium">{control.field.label}</legend>
					<div class="flex flex-wrap gap-x-4 gap-y-1.5">
						{#each control.options as option (option.value)}
							<label class="flex items-center gap-2 text-sm">
								<input
									type={control.type === 'checkboxes' ? 'checkbox' : 'radio'}
									name={control.name}
									value={option.value}
									checked={option.checked}
									class="size-4 accent-primary"
								/>
								{option.label}
							</label>
						{/each}
					</div>
				</fieldset>
			{/each}

			<div class="flex items-center justify-between gap-2">
				<a
					href={view.clearFiltersHref}
					class="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
				>
					Clear filters
				</a>
				<button
					type="submit"
					class="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
				>
					Apply
				</button>
			</div>
		</form>
	</details>
{/if}

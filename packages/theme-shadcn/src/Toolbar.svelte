<!--
	The toolbar above a list View. On a searchable Resource it holds a search box in a GET form:
	without JavaScript, submitting the form opens the search at page 1 and keeps the page size;
	with JavaScript, the list follows typing and the URL is updated in place, so the browser
	history doesn't fill up. Beside it, a count of the selected rows, once any are selected. The
	row is there on every Resource, so the content below doesn't move when the count appears.
	A Theme part, exported for a replaced list View: give it the core's `createListView` helper.
-->
<script module lang="ts">
	import type { ListViewState } from '@svelte-admin/core/views';

	export type ToolbarProps = {
		/** The list View helper from the core's `createListView`. */
		view: ListViewState;
	};
</script>

<script lang="ts">
	let { view }: ToolbarProps = $props();

	const form = $derived(view.searchForm);
	const searchId = $props.id();
</script>

<div class="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-2">
	{#if view.searchable}
		<form
			method="GET"
			action={form.action}
			role="search"
			class="flex w-full max-w-md items-center gap-2"
			onsubmit={(event) => {
				// With JavaScript, search in place instead, so an empty search names no `q`.
				event.preventDefault();
				view.submitSearch();
			}}
		>
			{#each form.hidden as [name, value] (name)}
				<input type="hidden" {name} {value} />
			{/each}
			<label for={searchId} class="sr-only">Search {view.resource.label.toLowerCase()}</label>
			<!-- A binding, not a value attribute, so text typed before hydration is kept and searched. -->
			<input
				id={searchId}
				type="search"
				name={form.name}
				bind:value={() => view.search, (text) => view.setSearch(text)}
				placeholder="Search {view.resource.label.toLowerCase()}…"
				autocomplete="off"
				class="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
			/>
			<button
				type="submit"
				class="inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted"
			>
				Search
			</button>
		</form>
	{/if}

	<!-- Always in the page, so a screen reader announces the count as it changes. -->
	<p aria-live="polite" class="text-sm text-muted-foreground">
		{#if view.selection.size > 0}
			{view.selection.size} selected
		{/if}
	</p>
</div>

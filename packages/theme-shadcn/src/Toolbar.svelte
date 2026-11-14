<!--
	The toolbar above a list View. On a searchable Resource it holds a search box in a GET form:
	without JavaScript, submitting the form opens the search at page 1 and keeps the page size;
	with JavaScript, the list follows typing and the URL is updated in place, so the browser
	history doesn't fill up. On any other Resource it shows nothing. A Theme part, driven by the
	core's `createListView`, so a replaced list View can render it too once the Theme exports it
	(M1.10).
-->
<script lang="ts">
	import type { ListViewState } from '@svelte-admin/core/views';

	let { view }: { view: ListViewState } = $props();

	const form = $derived(view.searchForm);
	const searchId = $props.id();
</script>

{#if view.searchable}
	<form
		method="GET"
		action={form.action}
		role="search"
		class="flex items-center gap-2"
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
			class="h-9 w-full max-w-sm rounded-md border bg-background px-3 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
		/>
		<button
			type="submit"
			class="inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted"
		>
			Search
		</button>
	</form>
{/if}

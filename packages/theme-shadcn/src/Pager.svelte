<!--
	The pager under a list View: page-size choices, the rows shown, and links to other pages.
	With a total it shows the page count and first, previous, next and last links; when the
	backend can't count (`hasNextPage`), only previous and next. Every control is a plain link,
	so it works without JavaScript. A Theme part, exported for a replaced list View: give it the
	core's `createListView` helper and the page it awaited from `view.query`.
-->
<script module lang="ts">
	import type { ListResult } from '@svelte-admin/core';
	import type { ListViewState } from '@svelte-admin/core/views';

	export type PagerProps = {
		/** The list View helper from the core's `createListView`. */
		view: ListViewState;
		/** The current page of records: what `view.query` resolved to. */
		result: ListResult<unknown>;
	};
</script>

<script lang="ts">
	import { formatNumber } from './format.ts';

	let { view, result }: PagerProps = $props();

	const page = $derived(view.params.page);
	const perPage = $derived(view.params.perPage);
	/** The total and page count when the backend counts, otherwise `undefined`. */
	const counted = $derived(
		'total' in result
			? { total: result.total, pageCount: Math.max(1, Math.ceil(result.total / perPage)) }
			: undefined
	);
	const hasNext = $derived(
		'hasNextPage' in result ? result.hasNextPage : page < (counted?.pageCount ?? 0)
	);
	const rowsLabel = $derived.by(() => {
		if (result.data.length === 0) return 'No rows on this page';
		const first = (page - 1) * perPage + 1;
		const range = `Rows ${formatNumber(first)}–${formatNumber(first + result.data.length - 1)}`;
		return counted ? `${range} of ${formatNumber(counted.total)}` : range;
	});

	const buttonClass = 'inline-flex h-8 items-center rounded-md border px-3 font-medium';
</script>

{#snippet pageLink(label: string, target: number, enabled: boolean)}
	{#if enabled}
		<a href={view.pageHref(target)} class="{buttonClass} bg-background hover:bg-muted">{label}</a>
	{:else}
		<span aria-disabled="true" class="{buttonClass} text-muted-foreground opacity-50">{label}</span>
	{/if}
{/snippet}

<nav aria-label="Pagination" class="flex flex-wrap items-center justify-between gap-4 text-sm">
	<div class="flex items-center gap-1">
		<span class="mr-1 text-muted-foreground">Rows per page</span>
		{#each view.perPageOptions as size (size)}
			<a
				href={view.perPageHref(size)}
				aria-label="{size} rows per page"
				aria-current={size === perPage ? 'true' : undefined}
				class="inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 font-medium tabular-nums hover:bg-muted aria-[current]:bg-primary aria-[current]:text-primary-foreground"
			>
				{size}
			</a>
		{/each}
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<span class="text-muted-foreground tabular-nums">{rowsLabel}</span>
		{#if counted}
			<span class="tabular-nums">
				Page {formatNumber(page)} of {formatNumber(counted.pageCount)}
			</span>
			{@render pageLink('First', 1, page > 1)}
		{/if}
		{@render pageLink('Previous', page - 1, page > 1)}
		{@render pageLink('Next', page + 1, hasNext)}
		{#if counted}
			<!-- Also from past the end, e.g. an old link to a page that no longer exists. -->
			{@render pageLink('Last', counted.pageCount, page !== counted.pageCount)}
		{/if}
	</div>
</nav>

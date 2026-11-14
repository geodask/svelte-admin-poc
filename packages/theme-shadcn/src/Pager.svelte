<!--
	The pager under a list View: page-size choices, the rows shown, and links to other pages.
	With a total it shows the page count and first, previous, next and last links; when the
	backend can't count (`hasNextPage`), only previous and next. Every control is a plain link,
	so it works without JavaScript. A Theme part: a replaced list View can render it with its
	own `createListView` (exported in M1.10).
-->
<script lang="ts">
	import type { ListResult } from '@svelte-admin/core';
	import type { ListViewState } from '@svelte-admin/core/views';
	import { formatNumber } from './format.ts';

	let { view, result }: { view: ListViewState; result: ListResult<unknown> } = $props();

	const page = $derived(view.params.page);
	const perPage = $derived(view.params.perPage);
	const pageCount = $derived(
		'total' in result ? Math.max(1, Math.ceil(result.total / perPage)) : undefined
	);
	const hasNext = $derived('total' in result ? page * perPage < result.total : result.hasNextPage);
	const rows = $derived.by(() => {
		if (result.data.length === 0) return 'No rows on this page';
		const first = (page - 1) * perPage + 1;
		const range = `Rows ${formatNumber(first)}–${formatNumber(first + result.data.length - 1)}`;
		return 'total' in result ? `${range} of ${formatNumber(result.total)}` : range;
	});

	const link =
		'inline-flex h-8 items-center rounded-md border bg-background px-3 font-medium hover:bg-muted';
	const disabled =
		'inline-flex h-8 items-center rounded-md border px-3 font-medium text-muted-foreground opacity-50';
</script>

{#snippet pageLink(label: string, target: number, enabled: boolean)}
	{#if enabled}
		<a href={view.pageHref(target)} class={link}>{label}</a>
	{:else}
		<span aria-disabled="true" class={disabled}>{label}</span>
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
		<span class="text-muted-foreground tabular-nums">{rows}</span>
		{#if pageCount !== undefined}
			<span class="tabular-nums">Page {formatNumber(page)} of {formatNumber(pageCount)}</span>
			{@render pageLink('First', 1, page > 1)}
		{/if}
		{@render pageLink('Previous', page - 1, page > 1)}
		{@render pageLink('Next', page + 1, hasNext)}
		{#if pageCount !== undefined}
			{@render pageLink('Last', pageCount, page < pageCount)}
		{/if}
	</div>
</nav>

<script lang="ts">
	import type { ListView } from '#lib/core/list-view.svelte.ts';
	let { list, total }: { list: ListView; total: number } = $props();
	const pages = $derived(list.pageCount(total));
	const cur = $derived(list.params.page);
	const btn = 'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm';
</script>

<nav class="flex items-center gap-1 text-sm">
	<span class="mr-2 text-muted-foreground">{total} total</span>
	<a class="{btn} {cur <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-accent'}" href={list.pageHref(cur - 1)} aria-label="Previous">‹</a>
	{#each Array.from({ length: pages }, (_, i) => i + 1) as n}
		<a class="{btn} {n === cur ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}" href={list.pageHref(n)}>{n}</a>
	{/each}
	<a class="{btn} {cur >= pages ? 'pointer-events-none opacity-40' : 'hover:bg-accent'}" href={list.pageHref(cur + 1)} aria-label="Next">›</a>
</nav>

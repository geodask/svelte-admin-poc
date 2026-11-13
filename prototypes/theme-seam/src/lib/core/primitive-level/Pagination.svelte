<script lang="ts">
	import type { ListView } from '../list-view.svelte.ts';
	import { primitives } from './primitives';
	let { list, total }: { list: ListView; total: number } = $props();
	const P = primitives();
	const pages = $derived(list.pageCount(total));
	const cur = $derived(list.params.page);
</script>

<nav class="sa-pager">
	<P.Muted>{total} total</P.Muted>
	<P.LinkButton variant="outline" label="Previous" disabled={cur <= 1} href={list.pageHref(cur - 1)}>‹</P.LinkButton>
	{#each Array.from({ length: pages }, (_, i) => i + 1) as n}
		<P.LinkButton variant={n === cur ? 'default' : 'outline'} href={list.pageHref(n)}>{n}</P.LinkButton>
	{/each}
	<P.LinkButton variant="outline" label="Next" disabled={cur >= pages} href={list.pageHref(cur + 1)}>›</P.LinkButton>
</nav>

<style>
	.sa-pager { display: flex; align-items: center; gap: 0.25rem; }
</style>

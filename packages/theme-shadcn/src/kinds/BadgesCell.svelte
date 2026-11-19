<!--
	The Theme's `badges` Kind in a list View cell: the first three items as badges, then "+N" for
	the rest, so a row stays one line high. Every item is in the cell's `title`. FieldCell renders
	it for a list of text or enum values only.
-->
<script lang="ts">
	import type { KindCellProps } from '@svelte-admin/core';
	import { CELL_ITEMS_SHOWN, formatScalar } from '../format.ts';
	import { isBadgeList } from '../kinds.ts';
	import Badges from './Badges.svelte';

	let { value }: Pick<KindCellProps, 'value'> = $props();

	const items = $derived(isBadgeList(value) ? value : []);
</script>

<span class="inline-flex items-center gap-1" title={items.map(formatScalar).join(', ')}>
	<Badges items={items.slice(0, CELL_ITEMS_SHOWN)} class="flex-nowrap" />
	{#if items.length > CELL_ITEMS_SHOWN}
		<span class="text-xs text-muted-foreground">+{items.length - CELL_ITEMS_SHOWN}</span>
	{/if}
</span>

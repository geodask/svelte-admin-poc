<!--
	The Theme's `badges` Kind in a list View cell: the first three items as badges, then "+N" for
	the rest, so a row stays one line high. Every item is in the cell's `title`. A value that isn't
	a list of text or enum values shows as the built-in cell.
-->
<script lang="ts">
	import type { KindCellProps } from '@svelte-admin/core';
	import FieldCell from '../FieldCell.svelte';
	import { formatScalar } from '../format.ts';
	import { isBadgeList, withoutNamedKind } from '../kinds.ts';
	import Badges from './Badges.svelte';

	/** How many badges the cell shows before "+N". */
	const SHOWN = 3;

	let { field, value, record }: KindCellProps = $props();
</script>

{#if isBadgeList(value)}
	<span class="inline-flex items-center gap-1" title={value.map(formatScalar).join(', ')}>
		<Badges items={value.slice(0, SHOWN)} class="flex-nowrap" />
		{#if value.length > SHOWN}
			<span class="text-xs text-muted-foreground">+{value.length - SHOWN}</span>
		{/if}
	</span>
{:else}
	<FieldCell field={withoutNamedKind(field)} {value} {record} />
{/if}

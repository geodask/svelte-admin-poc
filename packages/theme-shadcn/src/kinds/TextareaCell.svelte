<!--
	The Theme's `textarea` Kind in a list View cell: the text on one line, cut with an ellipsis,
	with the full text in its `title`. A value that isn't text shows as the built-in cell.
-->
<script lang="ts">
	import type { KindCellProps } from '@svelte-admin/core';
	import FieldCell from '../FieldCell.svelte';
	import { withoutNamedKind } from '../kinds.ts';

	let { field, value, record }: KindCellProps = $props();
</script>

{#if typeof value === 'string'}
	<span class="block max-w-xs truncate" title={value}>{value}</span>
{:else}
	<FieldCell field={withoutNamedKind(field)} {value} {record} />
{/if}

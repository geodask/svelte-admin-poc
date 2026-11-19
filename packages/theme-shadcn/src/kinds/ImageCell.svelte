<!--
	The Theme's `image` Kind in a list View cell: a small fixed-size thumbnail, loaded lazily, with
	the Field's label as its `alt`. A URL the core's `imageSrc` rule doesn't allow (`javascript:`,
	`data:`, `//host`, a relative path) is never loaded: it shows as muted text. A value that isn't
	text shows as the built-in cell.
-->
<script lang="ts">
	import { imageSrc, type KindCellProps } from '@svelte-admin/core';
	import FieldCell from '../FieldCell.svelte';
	import { withoutNamedKind } from '../kinds.ts';

	let { field, value, record }: KindCellProps = $props();

	const src = $derived(imageSrc(value));
</script>

{#if typeof value !== 'string'}
	<FieldCell field={withoutNamedKind(field)} {value} {record} />
{:else if src === undefined}
	<span class="block max-w-xs truncate text-muted-foreground" title={value}>{value}</span>
{:else}
	<img
		{src}
		alt={field.label}
		loading="lazy"
		width="40"
		height="40"
		class="size-10 max-w-none rounded-md border object-cover"
	/>
{/if}

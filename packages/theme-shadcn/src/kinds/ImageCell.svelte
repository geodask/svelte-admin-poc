<!--
	The Theme's `image` Kind in a list View cell: a small fixed-size thumbnail, loaded lazily, with
	the Field's label as its `alt`. A URL the core's `imageSrc` rule doesn't allow (`javascript:`,
	`data:`, `//host`, a relative path) is never loaded: it shows as muted text. FieldCell renders it
	for text only.
-->
<script lang="ts">
	import { imageSrc, type KindCellProps } from '@svelte-admin/core';

	let { field, value }: Pick<KindCellProps, 'field' | 'value'> = $props();

	const src = $derived(imageSrc(value));
</script>

{#if src === undefined}
	<span class="block max-w-xs truncate text-muted-foreground" title={String(value)}>{value}</span>
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

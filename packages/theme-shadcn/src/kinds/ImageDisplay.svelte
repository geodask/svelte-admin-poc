<!--
	The Theme's `image` Kind on the detail View: the image, loaded lazily, with the Field's label
	as its `alt`. A URL the core's `imageSrc` rule doesn't allow is never loaded: it shows as muted
	text. A value that isn't text shows as the built-in value.
-->
<script lang="ts">
	import { imageSrc, type KindDisplayProps } from '@svelte-admin/core';
	import FieldValue from '../FieldValue.svelte';
	import { withoutNamedKind } from '../kinds.ts';

	let { field, value, record }: KindDisplayProps = $props();

	const src = $derived(imageSrc(value));
</script>

{#if typeof value !== 'string'}
	<FieldValue field={withoutNamedKind(field)} {value} {record} />
{:else if src === undefined}
	<span class="break-all text-muted-foreground">{value}</span>
{:else}
	<img
		{src}
		alt={field.label}
		loading="lazy"
		class="max-h-64 max-w-full rounded-md border object-contain"
	/>
{/if}

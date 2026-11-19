<!--
	The Theme's `image` Kind on the detail View: the image, loaded lazily, with the Field's label
	as its `alt`. A URL the core's `imageSrc` rule doesn't allow is never loaded: it shows as muted
	text. FieldValue renders it for text only.
-->
<script lang="ts">
	import { imageSrc, type KindDisplayProps } from '@svelte-admin/core';

	let { field, value }: Pick<KindDisplayProps, 'field' | 'value'> = $props();

	const src = $derived(imageSrc(value));
</script>

{#if src === undefined}
	<span class="break-all text-muted-foreground">{value}</span>
{:else}
	<img
		{src}
		alt={field.label}
		loading="lazy"
		class="max-h-64 max-w-full rounded-md border object-contain"
	/>
{/if}

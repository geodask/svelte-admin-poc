<!-- PROTOTYPE (PER-18): an app replacing the Recipes list View by writing a route at its path
     (PER-13). Each seam gets its own version so the cost is comparable. -->
<script lang="ts">
	import { page } from '$app/state';
	import { variantOf } from '#lib/variants.ts';
	import PrimitivesProvider from '#lib/PrimitivesProvider.svelte';
	import { tailwindTheme } from '#lib/themes/primitive-tailwind/index.ts';
	import { plainTheme } from '#lib/themes/primitive-plain/index.ts';
	import GalleryViewLevel from './GalleryViewLevel.svelte';
	import GalleryViewLevelNoParts from './GalleryViewLevelNoParts.svelte';
	import GalleryPrimitiveLevel from './GalleryPrimitiveLevel.svelte';

	const v = $derived(variantOf(page.url));
</script>

{#key v.key}
	{#if v.key === 'A1'}<GalleryViewLevel />
	{:else if v.key === 'A2'}<GalleryViewLevelNoParts />
	{:else}
		<PrimitivesProvider theme={v.key === 'B1' ? tailwindTheme : plainTheme}><GalleryPrimitiveLevel /></PrimitivesProvider>
	{/if}
{/key}

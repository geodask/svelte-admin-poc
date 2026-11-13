<!-- PROTOTYPE (PER-18): the framework's own list route. In the real thing it renders
     theme.ListView (View-level) or core ListView (Primitive-level) from admin.ts config. -->
<script lang="ts">
	import { page } from '$app/state';
	import { recipes } from '#lib/recipes.ts';
	import * as remote from '#lib/recipes.remote.ts';
	import { variantOf } from '#lib/variants.ts';
	import PrimitivesProvider from '#lib/PrimitivesProvider.svelte';
	import * as A1 from '#lib/themes/view-level-tailwind/index.ts';
	import * as A2 from '#lib/themes/view-level-cards/index.ts';
	import * as Core from '#lib/core/primitive-level/index.ts';
	import { tailwindTheme } from '#lib/themes/primitive-tailwind/index.ts';
	import { plainTheme } from '#lib/themes/primitive-plain/index.ts';

	const v = $derived(variantOf(page.url));
</script>

{#key v.key}
	{#if v.key === 'A1'}<A1.ListView resource={recipes} {remote} />
	{:else if v.key === 'A2'}<A2.ListView resource={recipes} {remote} />
	{:else}
		<PrimitivesProvider theme={v.key === 'B1' ? tailwindTheme : plainTheme}>
			<Core.ListView resource={recipes} {remote} />
		</PrimitivesProvider>
	{/if}
{/key}

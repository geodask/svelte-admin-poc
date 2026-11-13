<script lang="ts">
	import { page } from '$app/state';
	import { getLastWrite, getOne } from '#lib/recipes.remote.ts';
	const record = $derived(await getOne(Number(page.params.id)));
	const last = $derived(await getLastWrite());
	const saved = $derived(page.url.searchParams.get('saved'));
</script>

<h1>{record.name} <small>detail (stub)</small></h1>
{#if saved}<p class="saved">Recipe {saved}. <a href="/recipes/{record.id}/edit">Edit again</a></p>{/if}
<div class="layout">
	<div>
		<h3>Stored record</h3>
		<pre>{JSON.stringify(record, null, 2)}</pre>
	</div>
	<aside class="state">
		<h3>What the Provider received ({last.op ?? 'nothing yet'})</h3>
		<pre>{JSON.stringify(last.payload ?? null, null, 1)}</pre>
	</aside>
</div>

<script lang="ts">
	import { page } from '$app/state';
	import ResourceForm from '#lib/framework/ResourceForm.svelte';
	import { recipes } from '#lib/recipes.ts';
	import { getOne, update } from '#lib/recipes.remote.ts';
	const record = $derived(await getOne(Number(page.params.id)));
</script>

<h1>Edit {record.name} <small>edit View</small></h1>
{#key record.id}
	<ResourceForm resource={recipes} view="edit" form={update.for(record.id)} {record} />
{/key}

<script lang="ts">
	import ResourceForm from '#lib/framework/ResourceForm.svelte';
	import { recipes } from '#lib/recipes.ts';
	import { create } from '#lib/recipes.remote.ts';
</script>

<h1>New recipe <small>create View</small></h1>
<ResourceForm resource={recipes} view="create" form={create} />

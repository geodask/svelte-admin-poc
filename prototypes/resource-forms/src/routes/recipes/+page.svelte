<script lang="ts">
	import { getList } from '#lib/recipes.remote.ts';
	const list = $derived(await getList());
</script>

<h1>Recipes</h1>
<table>
	<thead><tr><th>Name</th><th>Cuisine</th><th>Servings</th><th></th></tr></thead>
	<tbody>
		{#each list.data as r (r.id)}
			<tr><td><a href="/recipes/{r.id}">{r.name}</a></td><td>{r.cuisine}</td><td>{r.servings}</td><td><a href="/recipes/{r.id}/edit">Edit</a></td></tr>
		{/each}
	</tbody>
</table>
<p><a href="/recipes/new">New recipe</a></p>

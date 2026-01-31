<script lang="ts">
	import { getBerrys, getBerryFlavors, getUsers } from '../resources.remote';
</script>

<h1>Berries</h1>

{#each await getBerrys() as berry}
	<p>{berry.name}</p>
{/each}

<h2>Berries Flavors</h2>

{#each await getBerryFlavors() as flavor}
	<p>{flavor.name}</p>
{/each}

{#each await getUsers() as user}
	<p>{user.name} - {user.email}</p>
{/each}

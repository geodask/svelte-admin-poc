<script lang="ts">
	import { useResource } from '../resources';

	const { getMany: getBerries, create: createBerry } = useResource('berries');
	const { getMany: getBerryFirmness } = useResource('berry-firmness');
	const {} = useResource('berry-flavors');
	const { getOne: getA } = useResource('a');

</script>

<h1>Berries</h1>

{#each await getBerries() as berry}
	<p>{berry.name}</p>
{/each}

<!-- <h2>Berry firmness</h2>

{#each await getBerryFirmness() as firmness}
	<p>{firmness.name}</p>
{/each}

<h2>Berry flavors</h2>

{#each await getBerryFlavors() as flavor}
	<p>{flavor.name}</p>
{/each} -->

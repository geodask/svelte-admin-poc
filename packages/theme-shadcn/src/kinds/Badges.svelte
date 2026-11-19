<!-- Items as badges, in a list, so a screen reader counts them. -->
<script lang="ts">
	import type { ClassValue } from 'svelte/elements';
	import { Badge } from '../components/ui/badge/index.ts';
	import { formatScalar } from '../format.ts';

	let { items, class: className }: { items: readonly (string | number)[]; class?: ClassValue } =
		$props();
</script>

<ul class={['flex gap-1', className]}>
	{#each items as item, index (index)}
		<li><Badge>{formatScalar(item)}</Badge></li>
	{/each}
</ul>

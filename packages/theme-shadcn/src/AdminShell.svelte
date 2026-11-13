<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div data-admin-shell>
	<main>
		{@render children()}
	</main>
</div>

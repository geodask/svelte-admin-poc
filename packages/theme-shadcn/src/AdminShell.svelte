<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div data-admin-shell class="min-h-screen bg-background text-foreground">
	<main class="mx-auto max-w-7xl p-6">
		{@render children()}
	</main>
</div>

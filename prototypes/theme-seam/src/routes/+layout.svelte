<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import PrototypeSwitcher from '#lib/PrototypeSwitcher.svelte';
	import SeamPanel from '#lib/SeamPanel.svelte';
	let { children } = $props();
	const keep = $derived(page.url.searchParams.get('variant') ? `?variant=${page.url.searchParams.get('variant')}` : '');
</script>

<svelte:head><title>PROTOTYPE: core/Theme seam</title></svelte:head>

<header class="flex items-center gap-4 border-b bg-white px-5 py-3 font-sans text-sm">
	<strong>Svelte Admin</strong>
	<span class="rounded bg-amber-200 px-1.5 py-0.5 text-xs">PROTOTYPE (PER-18), throwaway</span>
	<nav class="ml-auto flex gap-4">
		<a href="/recipes{keep}" class:font-semibold={page.url.pathname === '/recipes'}>Stock list View</a>
		<a href="/recipes/gallery{keep}" class:font-semibold={page.url.pathname === '/recipes/gallery'}>Replaced View (app route)</a>
	</nav>
</header>

<main class="mx-auto max-w-6xl p-6">
	<svelte:boundary>
		{@render children()}
		{#snippet failed(error, reset)}<p>Error: {(error as Error).message}</p><button onclick={reset}>Retry</button>{/snippet}
	</svelte:boundary>
</main>

<SeamPanel />
<PrototypeSwitcher />

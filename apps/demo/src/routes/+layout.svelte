<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';

	let { children } = $props();

	// For the e2e tests: once the page is hydrated, it is marked, so a test that types waits for
	// the app to listen instead of typing into server-rendered markup that hydration replaces.
	onMount(() => {
		document.documentElement.dataset.hydrated = '';
	});
</script>

{@render children()}

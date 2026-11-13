<!-- PROTOTYPE (PER-17): floating switcher for how arrays of text are edited. Hidden in production. -->
<script lang="ts">
	import { dev } from '$app/env';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	const variants = [
		{ key: 'rows', name: 'A: one input per item' },
		{ key: 'lines', name: 'B: one item per line' }
	];
	const current = $derived(page.url.searchParams.get('arrays') === 'lines' ? 1 : 0);

	function go(step: number) {
		const next = variants[(current + step + variants.length) % variants.length];
		const url = new URL(page.url.href);
		url.searchParams.set('arrays', next.key);
		// full reload: the prefill runs once per page load
		location.href = url.toString();
	}

	function onkeydown(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		if (t.closest('input, textarea, select, [contenteditable]')) return;
		if (e.key === 'ArrowLeft') go(-1);
		if (e.key === 'ArrowRight') go(1);
	}
	void goto;
</script>

<svelte:window {onkeydown} />

{#if dev}
	<div class="switcher">
		<button type="button" onclick={() => go(-1)}>←</button>
		<span>Arrays of text: {variants[current].name}</span>
		<button type="button" onclick={() => go(1)}>→</button>
	</div>
{/if}

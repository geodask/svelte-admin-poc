<!-- PROTOTYPE (PER-18): floating variant switcher. Hidden in production. -->
<script lang="ts">
	import { dev } from '$app/env';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { variants, variantOf } from './variants';

	const current = $derived(variants.indexOf(variantOf(page.url)));

	function go(step: number) {
		const next = variants[(current + step + variants.length) % variants.length];
		const url = new URL(page.url.href);
		url.searchParams.set('variant', next.key);
		goto(url, { replace: true, reset: false });
	}

	function onkeydown(e: KeyboardEvent) {
		if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
		if (e.key === 'ArrowLeft') go(-1);
		if (e.key === 'ArrowRight') go(1);
	}
</script>

<svelte:window {onkeydown} />

{#if dev}
	<div class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black px-3 py-1.5 font-sans text-[13px] text-white shadow-xl">
		<button class="size-7 rounded-full bg-neutral-700" onclick={() => go(-1)}>←</button>
		<span>{variants[current].key}: {variants[current].name}</span>
		<button class="size-7 rounded-full bg-neutral-700" onclick={() => go(1)}>→</button>
	</div>
{/if}

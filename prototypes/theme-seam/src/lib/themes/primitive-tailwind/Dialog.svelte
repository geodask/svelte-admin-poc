<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { open, title, description, onclose, actions }: PropsOf<'Dialog'> = $props();
	let el = $state<HTMLDialogElement>();
	$effect(() => { if (open && !el?.open) el?.showModal(); if (!open && el?.open) el.close(); });
</script>
<dialog bind:this={el} {onclose} class="m-auto w-96 rounded-lg border p-6 shadow-lg backdrop:bg-black/40">
	<h2 class="text-lg font-semibold">{title}</h2>
	{#if description}<p class="mt-2 text-sm text-muted-foreground">{description}</p>{/if}
	<div class="mt-6 flex justify-end gap-2">{@render actions()}</div>
</dialog>

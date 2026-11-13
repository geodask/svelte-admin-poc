<script lang="ts">
	import type { ListView } from '#lib/core/list-view.svelte.ts';
	let { list }: { list: ListView } = $props();
	let dialog = $state<HTMLDialogElement>();
	const n = $derived(list.selection.size);
</script>

<button class="h-9 rounded-md bg-destructive px-3 text-sm font-medium text-white disabled:opacity-40" disabled={n === 0} onclick={() => dialog?.showModal()}>
	Delete {n || ''} selected
</button>

<dialog bind:this={dialog} class="m-auto w-96 rounded-lg border p-6 shadow-lg backdrop:bg-black/40">
	<h2 class="text-lg font-semibold">Delete {n} {n === 1 ? list.resource.singular : list.resource.label.toLowerCase()}?</h2>
	<p class="mt-2 text-sm text-muted-foreground">This can't be undone.</p>
	<div class="mt-6 flex justify-end gap-2">
		<button class="h-9 rounded-md border px-3 text-sm" onclick={() => dialog?.close()}>Cancel</button>
		<button class="h-9 rounded-md bg-destructive px-3 text-sm text-white" onclick={async () => { await list.deleteSelected(); dialog?.close(); }}>Delete</button>
	</div>
</dialog>

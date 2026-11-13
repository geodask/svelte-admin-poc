<script lang="ts">
	import type { ListView } from '../list-view.svelte.ts';
	import { primitives } from './primitives';
	let { list }: { list: ListView } = $props();
	const P = primitives();
	let open = $state(false);
	const n = $derived(list.selection.size);
</script>

<P.Button variant="destructive" disabled={n === 0} onclick={() => (open = true)}>Delete {n || ''} selected</P.Button>

<P.Dialog {open} onclose={() => (open = false)} title="Delete {n} {n === 1 ? list.resource.singular : list.resource.label.toLowerCase()}?" description="This can't be undone.">
	{#snippet actions()}
		<P.Button variant="outline" onclick={() => (open = false)}>Cancel</P.Button>
		<P.Button variant="destructive" onclick={async () => { await list.deleteSelected(); open = false; }}>Delete</P.Button>
	{/snippet}
</P.Dialog>

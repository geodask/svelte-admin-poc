<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { children }: PropsOf<'Table'> = $props();
</script>
<table class="t">{@render children()}</table>
<style>
	.t { width: 100%; border-collapse: separate; border-spacing: 0 6px; font-family: Georgia, serif; color: #2b2118; }
	.t :global(thead th) { text-transform: uppercase; font-size: 11px; letter-spacing: 0.1em; color: #8a7350; font-weight: normal; }
	.t :global(tbody tr) { background: #fffaf0; box-shadow: 0 2px 0 #e8dcc8; }
	.t :global(tbody tr[data-selected]) { outline: 2px solid #8a3b12; }
	.t :global(tbody td:first-child) { border-radius: 10px 0 0 10px; }
	.t :global(tbody td:last-child) { border-radius: 0 10px 10px 0; }
</style>

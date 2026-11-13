<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { name, value, label, options }: PropsOf<'Select'> = $props();
</script>
<select {name} {value} aria-label={label}>
	{#each options as o}<option value={o.value}>{o.label}</option>{/each}
</select>
<style>select { font: 15px Georgia, serif; padding: 0.35rem 0.6rem; border: 1px solid #cbb994; border-radius: 999px; background: #fffaf0; }</style>

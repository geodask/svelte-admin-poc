<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { name, value, label, options }: PropsOf<'Select'> = $props();
</script>
<select {name} {value} aria-label={label} class="h-9 rounded-md border bg-background px-3 text-sm">
	{#each options as o}<option value={o.value}>{o.label}</option>{/each}
</select>

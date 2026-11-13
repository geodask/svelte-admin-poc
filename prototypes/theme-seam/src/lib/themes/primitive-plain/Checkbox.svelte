<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { checked, label, onchange }: PropsOf<'Checkbox'> = $props();
</script>
<input type="checkbox" {checked} aria-label={label} onchange={(e) => onchange(e.currentTarget.checked)} />
<style>input { accent-color: #8a3b12; width: 1rem; height: 1rem; }</style>

<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { checked, label, onchange }: PropsOf<'Checkbox'> = $props();
</script>
<input type="checkbox" {checked} aria-label={label} onchange={(e) => onchange(e.currentTarget.checked)} class="size-4 accent-primary" />

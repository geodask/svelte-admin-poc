<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { name, value, placeholder }: PropsOf<'Input'> = $props();
</script>
<input {name} {value} {placeholder} class="h-9 w-64 rounded-md border bg-background px-3 text-sm" />

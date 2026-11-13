<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { name, value, placeholder }: PropsOf<'Input'> = $props();
</script>
<input {name} {value} {placeholder} />
<style>input { font: 15px Georgia, serif; padding: 0.35rem 0.8rem; border: 1px solid #cbb994; border-radius: 999px; background: #fffaf0; width: 14rem; }</style>

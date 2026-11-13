<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { align = 'left', children }: PropsOf<'Td'> = $props();
</script>
<td style:text-align={align}>{@render children?.()}</td>
<style>td { padding: 0.6rem 0.8rem; }</style>

<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { align = 'left', children }: PropsOf<'Td'> = $props();
</script>
<td class="px-3 py-2 {align === 'right' ? 'text-right tabular-nums' : ''}">{@render children?.()}</td>

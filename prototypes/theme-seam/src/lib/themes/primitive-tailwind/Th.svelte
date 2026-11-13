<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { align = 'left', children }: PropsOf<'Th'> = $props();
</script>
<th class="px-3 py-2 font-medium {align === 'right' ? 'text-right' : 'text-left'}">{@render children?.()}</th>

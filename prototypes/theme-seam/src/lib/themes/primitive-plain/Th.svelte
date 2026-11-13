<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { align = 'left', children }: PropsOf<'Th'> = $props();
</script>
<th style:text-align={align}>{@render children?.()}</th>
<style>th { padding: 0.3rem 0.8rem; }</style>

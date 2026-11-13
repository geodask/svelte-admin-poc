<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { children }: PropsOf<'Muted'> = $props();
</script>
<span>{@render children()}</span>
<style>span { color: #8a7350; font-family: Georgia, serif; font-size: 14px; }</style>

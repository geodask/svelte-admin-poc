<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { children }: PropsOf<'Heading'> = $props();
</script>
<h1>{@render children()}</h1>
<style>h1 { font: italic 2rem Georgia, serif; margin: 0; color: #2b2118; }</style>

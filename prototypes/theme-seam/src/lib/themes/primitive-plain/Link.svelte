<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { href, children }: PropsOf<'Link'> = $props();
</script>
<a {href}>{@render children()}</a>
<style>a { color: #8a3b12; font-weight: bold; text-decoration: none; font-family: Georgia, serif; }</style>

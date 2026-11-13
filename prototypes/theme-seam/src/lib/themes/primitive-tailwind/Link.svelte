<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { href, children }: PropsOf<'Link'> = $props();
</script>
<a {href} class="font-medium underline-offset-4 hover:underline">{@render children()}</a>

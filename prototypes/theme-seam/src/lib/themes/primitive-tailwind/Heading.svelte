<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { children }: PropsOf<'Heading'> = $props();
</script>
<h1 class="text-2xl font-semibold tracking-tight">{@render children()}</h1>

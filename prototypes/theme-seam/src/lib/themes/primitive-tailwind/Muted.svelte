<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { children }: PropsOf<'Muted'> = $props();
</script>
<span class="text-sm text-muted-foreground">{@render children()}</span>

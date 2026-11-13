<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { children }: PropsOf<'Table'> = $props();
</script>
<div class="overflow-hidden rounded-lg border">
	<table class="w-full text-sm [&_thead]:bg-muted/50 [&_thead]:text-muted-foreground [&_tbody_tr]:border-t [&_tbody_tr:hover]:bg-muted/40 [&_tr[data-selected]]:bg-muted">{@render children()}</table>
</div>

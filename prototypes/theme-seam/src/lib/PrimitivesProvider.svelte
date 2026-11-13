<!-- PROTOTYPE (PER-18): in the real thing the admin shell sets this once from admin.ts. -->
<script lang="ts">
	import { setPrimitives, type Primitives } from '#lib/core/primitive-level/primitives.ts';
	let { theme, children }: { theme: Primitives; children: import('svelte').Snippet } = $props();
	// svelte-ignore state_referenced_locally
	setPrimitives(theme);
</script>
{@render children()}

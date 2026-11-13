<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { tone = 'default', children }: PropsOf<'Badge'> = $props();
	const tones: Record<string, string> = { default: 'border', muted: 'bg-muted border-transparent', positive: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
</script>
<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium {tones[tone]}">{@render children()}</span>

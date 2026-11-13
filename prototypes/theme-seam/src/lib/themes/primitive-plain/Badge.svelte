<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { tone = 'default', children }: PropsOf<'Badge'> = $props();
</script>
<span class={tone}>{@render children()}</span>
<style>
	span { font-size: 13px; }
	.default { font-style: italic; color: #8a3b12; }
	.muted { color: #5c7a3a; }
	.muted::before { content: '#'; }
	.positive { color: #5c7a3a; font-style: italic; }
</style>

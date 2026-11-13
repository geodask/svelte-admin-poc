<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { variant = 'default', type = 'button', disabled, onclick, children }: PropsOf<'Button'> = $props();
</script>
<button {type} {disabled} {onclick} class="b {variant}">{@render children()}</button>
<style>
	.b { font: 15px Georgia, serif; padding: 0.3rem 0.9rem; border-radius: 999px; border: 1px solid #cbb994; background: #fffaf0; color: #2b2118; cursor: pointer; }
	.default, .destructive { background: #8a3b12; border-color: #8a3b12; color: #fff; }
	.ghost { border-color: transparent; background: none; }
	.b:disabled { opacity: 0.4; cursor: default; }
</style>

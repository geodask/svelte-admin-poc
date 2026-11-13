<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	let { href, variant = 'default', active, disabled, label, children }: PropsOf<'LinkButton'> = $props();
</script>
<a {href} aria-label={label} aria-disabled={disabled} class="b {variant}" class:active class:disabled>{@render children()}</a>
<style>
	.b { font: 15px Georgia, serif; display: inline-block; min-width: 1.2rem; text-align: center; padding: 0.2rem 0.6rem; border-radius: 999px; border: 1px solid #cbb994; color: #2b2118; text-decoration: none; }
	.default { background: #8a3b12; border-color: #8a3b12; color: #fff; }
	.ghost { border: none; padding: 0; color: #8a7350; }
	.ghost.active { color: #8a3b12; font-weight: bold; }
	.disabled { opacity: 0.35; pointer-events: none; }
</style>

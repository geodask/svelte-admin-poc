<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	import { base, tone } from './variants';
	let { variant = 'default', type = 'button', disabled, onclick, children }: PropsOf<'Button'> = $props();
</script>
<button {type} {disabled} {onclick} class="{base} {tone[variant as keyof typeof tone]} disabled:pointer-events-none disabled:opacity-40">{@render children()}</button>

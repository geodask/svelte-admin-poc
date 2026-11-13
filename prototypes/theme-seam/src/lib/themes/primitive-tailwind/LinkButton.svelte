<script lang="ts">
	import type { PropsOf } from '#lib/core/primitive-level/primitives.ts';
	import { base, tone } from './variants';
	let { href, variant = 'default', active, disabled, label, children }: PropsOf<'LinkButton'> = $props();
</script>
<a {href} aria-label={label} aria-disabled={disabled} class="{base} {tone[variant as keyof typeof tone]} {variant === 'ghost' ? 'h-auto px-1 -mx-1 font-medium' : ''} {active ? 'text-foreground' : variant === 'ghost' ? 'text-muted-foreground' : ''} {disabled ? 'pointer-events-none opacity-40' : ''}">{@render children()}</a>

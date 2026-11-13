<!--
	shadcn's badge, without tailwind-variants: the Theme uses only these variants, so a plain
	map keeps the dependency out.
-->
<script lang="ts" module>
	export type BadgeVariant = 'default' | 'secondary' | 'outline';

	const variants: Record<BadgeVariant, string> = {
		default: 'border-transparent bg-primary text-primary-foreground',
		secondary: 'border-transparent bg-secondary text-secondary-foreground',
		outline: 'text-foreground'
	};
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '../../../utils.ts';

	let {
		ref = $bindable(null),
		variant = 'default',
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLSpanElement>> & { variant?: BadgeVariant } = $props();
</script>

<span
	bind:this={ref}
	data-slot="badge"
	class={cn(
		'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
		variants[variant],
		className
	)}
	{...restProps}
>
	{@render children?.()}
</span>

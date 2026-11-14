<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '../../../utils.ts';

	let {
		ref = $bindable(null),
		class: className,
		href,
		children,
		...restProps
	}: WithElementRef<HTMLAnchorAttributes, HTMLAnchorElement> = $props();
</script>

<a
	bind:this={ref}
	data-slot="breadcrumb-link"
	{href}
	class={cn('transition-colors hover:text-foreground', className)}
	{...restProps}
>
	{@render children?.()}
</a>

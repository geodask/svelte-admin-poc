<!--
	shadcn's sidebar in its non-collapsible form, the only one the shell uses: a column beside the
	content on wide screens and a block above it on narrow ones. It needs no JavaScript, so there
	is no mobile sheet and no collapsed state.
-->
<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '../../../utils.ts';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<aside
	bind:this={ref}
	data-slot="sidebar"
	class={cn(
		'flex w-full flex-col border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-svh md:w-(--sidebar-width) md:shrink-0 md:border-e md:border-b-0',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</aside>

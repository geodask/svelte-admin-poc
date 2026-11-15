<!--
	shadcn's sidebar wrapper, cut to what the static shell uses: no open state, cookie, keyboard
	shortcut or tooltips, so it renders the same with and without JavaScript.
-->
<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '../../../utils.ts';

	let {
		ref = $bindable(null),
		class: className,
		style,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="sidebar-wrapper"
	style="--sidebar-width: 16rem; {style ?? ''}"
	class={cn('group/sidebar-wrapper flex min-h-svh w-full flex-col md:flex-row', className)}
	{...restProps}
>
	{@render children?.()}
</div>

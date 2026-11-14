<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '../../../utils.ts';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> = $props();
</script>

<div
	bind:this={ref}
	data-slot="sidebar-inset"
	class={cn('relative flex w-full min-w-0 flex-1 flex-col bg-background', className)}
	{...restProps}
>
	{@render children?.()}
</div>

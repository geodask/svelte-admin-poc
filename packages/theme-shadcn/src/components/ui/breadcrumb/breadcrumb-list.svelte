<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '../../../utils.ts';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLOListElement>, HTMLOListElement> = $props();
</script>

<ol
	bind:this={ref}
	data-slot="breadcrumb-list"
	class={cn(
		'flex flex-wrap items-center gap-1.5 text-sm break-words text-muted-foreground sm:gap-2.5',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</ol>

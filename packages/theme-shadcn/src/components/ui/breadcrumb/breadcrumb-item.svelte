<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '../../../utils.ts';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLLIElement>, HTMLLIElement> = $props();
</script>

<li
	bind:this={ref}
	data-slot="breadcrumb-item"
	class={cn('inline-flex items-center gap-1.5', className)}
	{...restProps}
>
	{@render children?.()}
</li>

<!--
	shadcn's breadcrumb page, without its `role="link"`: the current page is plain text, not a
	link.
-->
<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '../../../utils.ts';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLSpanElement>> = $props();
</script>

<span
	bind:this={ref}
	data-slot="breadcrumb-page"
	aria-current="page"
	class={cn('font-normal text-foreground', className)}
	{...restProps}
>
	{@render children?.()}
</span>

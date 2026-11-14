<!--
	shadcn's sidebar menu button as a link, its default variant and size only, so it needs no
	tailwind-variants and no tooltip. An active link is marked with `data-active` and
	`aria-current`.
-->
<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '../../../utils.ts';

	let {
		ref = $bindable(null),
		class: className,
		isActive = false,
		children,
		...restProps
	}: WithElementRef<HTMLAnchorAttributes, HTMLAnchorElement> & { isActive?: boolean } = $props();
</script>

<a
	bind:this={ref}
	data-slot="sidebar-menu-button"
	data-sidebar="menu-button"
	data-active={isActive}
	aria-current={isActive ? 'true' : undefined}
	class={cn(
		'flex h-8 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-start text-sm ring-sidebar-ring outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</a>

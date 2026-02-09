<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { TargetIcon } from '@lucide/svelte';
	import type { ComponentProps } from 'svelte';
	import type { MenuConfig } from '$lib/resource/define-resource';
	import NavMain from './nav-main.svelte';
	import NavUser from './nav-user.svelte';

	type Props = {
		resources: any;
	};

	let { resources, ...restProps }: Props & ComponentProps<typeof Sidebar.Root> = $props();

	type MenuItem = {
		title: string;
		url: string;
		icon?: any;
		order: number;
		group: string;
	};

	type GroupedMenu = {
		[groupName: string]: MenuItem[];
	};

	/**
	 * Calculate menu items based on menu config with group, order and visibility
	 */
	const data = $derived.by(() => {
		const grouped: GroupedMenu = {};

		Object.entries(resources).forEach(([key, value]: [string, any]) => {
			const menuConfig: MenuConfig = value.metadata.menu;

			const isVisible =
				menuConfig === true || (typeof menuConfig === 'object' && menuConfig.visible !== false);

			if (!isVisible) return;
			const group = typeof menuConfig === 'object' ? (menuConfig.group ?? 'default') : 'default';
			const order = typeof menuConfig === 'object' ? (menuConfig.order ?? 0) : 0;

			const menuItem: MenuItem = {
				title: value.metadata.label,
				url: `/${key}`,
				icon: value.metadata.icon,
				order,
				group
			};

			if (!grouped[group]) {
				grouped[group] = [];
			}
			grouped[group].push(menuItem);
		});

		// Sort items within each group by order
		Object.keys(grouped).forEach((groupKey) => {
			grouped[groupKey].sort((a, b) => a.order - b.order);
		});

		// Create flat navMain array (sorted by group then order)
		const sortedGroups = Object.keys(grouped).sort((a, b) => {
			// "default" group comes first
			if (a === 'default') return -1;
			if (b === 'default') return 1;
			return a.localeCompare(b);
		});

		const navMain = sortedGroups.flatMap((groupKey) =>
			grouped[groupKey].map(({ order, group, ...item }) => item)
		);

		return {
			user: {
				name: 'shadcn',
				email: 'm@example.com',
				avatar: '/avatars/shadcn.jpg'
			},
			navMain,
			groupedMenu: grouped
		};
	});
</script>

<Sidebar.Root collapsible="offcanvas" {...restProps}>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton class="data-[slot=sidebar-menu-button]:p-1.5!">
					{#snippet child({ props })}
						<a href="##" {...props}>
							<TargetIcon class="size-5!" />
							<span class="text-base font-semibold">Acme Inc.</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>
	<Sidebar.Content>
		<NavMain groupedMenu={data.groupedMenu} />
	</Sidebar.Content>
	<Sidebar.Footer>
		<NavUser user={data.user} />
	</Sidebar.Footer>
</Sidebar.Root>

<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { TargetIcon } from '@lucide/svelte';
	import type { ComponentProps } from 'svelte';
	import { useResources } from '../../resources';
	import NavMain from './nav-main.svelte';
	import NavUser from './nav-user.svelte';

	const resources = useResources();

	const data = {
		user: {
			name: 'shadcn',
			email: 'm@example.com',
			avatar: '/avatars/shadcn.jpg'
		},
		navMain: [
			...Object.entries(resources).map(([key, value]) => ({
				title: value.metadata.label,
				url: `/${key}`,
				icon: value.metadata.icon
			}))
		]
	};

	let { ...restProps }: ComponentProps<typeof Sidebar.Root> = $props();
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
		<NavMain items={data.navMain} />
	</Sidebar.Content>
	<Sidebar.Footer>
		<NavUser user={data.user} />
	</Sidebar.Footer>
</Sidebar.Root>

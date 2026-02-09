<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { type Icon as IconType } from '@lucide/svelte';
	import CirclePlusFilledIcon from '@tabler/icons-svelte/icons/circle-plus-filled';
	import MailIcon from '@tabler/icons-svelte/icons/mail';

	type MenuItem = {
		title: string;
		url: string;
		icon?: typeof IconType;
	};

	type GroupedMenu = {
		[groupName: string]: MenuItem[];
	};

	let { groupedMenu }: { groupedMenu: GroupedMenu } = $props();

	// Sort groups: "default" first, then alphabetically
	const sortedGroups = $derived(
		Object.keys(groupedMenu).sort((a, b) => {
			if (a === 'default') return -1;
			if (b === 'default') return 1;
			return a.localeCompare(b);
		})
	);
</script>

<!-- Quick Create section -->
<Sidebar.Group>
	<Sidebar.GroupContent class="flex flex-col gap-2">
		<Sidebar.Menu>
			<Sidebar.MenuItem class="flex items-center gap-2">
				<Sidebar.MenuButton
					class="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
					tooltipContent="Quick create"
				>
					<CirclePlusFilledIcon />
					<span>Quick Create</span>
				</Sidebar.MenuButton>
				<Button
					size="icon"
					class="size-8 group-data-[collapsible=icon]:opacity-0"
					variant="outline"
				>
					<MailIcon />
					<span class="sr-only">Inbox</span>
				</Button>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.GroupContent>
</Sidebar.Group>

<!-- Menu groups -->
{#each sortedGroups as groupName (groupName)}
	<Sidebar.Group>
		{#if groupName !== 'default'}
			<Sidebar.GroupLabel>{groupName}</Sidebar.GroupLabel>
		{/if}
		<Sidebar.GroupContent>
			<Sidebar.Menu>
				{#each groupedMenu[groupName] as item (item.title)}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							isActive={page.url.pathname === item.url}
							tooltipContent={item.title}
						>
							{#snippet child({ props })}
								<a href={item.url} {...props}>
									{#if item.icon}
										<item.icon />
									{/if}
									<span>{item.title}</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				{/each}
			</Sidebar.Menu>
		</Sidebar.GroupContent>
	</Sidebar.Group>
{/each}

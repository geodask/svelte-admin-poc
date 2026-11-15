<!--
	The shell's sidebar: the app's brand, linking to the admin's first Resource, a link to each Resource's list View under its group with
	its icon, and the app's user menu. The current Resource's link stays active on its detail View.
-->
<script lang="ts">
	import type { ShellState } from '@svelte-admin/core/views';
	import type { Snippet } from 'svelte';
	import * as Sidebar from './components/ui/sidebar/index.ts';
	import ResourceIcon from './ResourceIcon.svelte';

	let { shell, brand, userMenu }: { shell: ShellState; brand?: Snippet; userMenu?: Snippet } =
		$props();

	const id = $props.id();
</script>

<Sidebar.Root>
	{#if brand}
		<Sidebar.Header>
			<a
				href={shell.homeHref}
				class="flex items-center gap-2 rounded-md p-1.5 text-base font-semibold hover:bg-sidebar-accent"
			>
				{@render brand()}
			</a>
		</Sidebar.Header>
	{/if}

	<Sidebar.Content>
		<nav aria-label="Resources">
			{#each shell.groups as group, index (group.label ?? '')}
				{@const labelId = `${id}-group-${index}`}
				<Sidebar.Group role="group" aria-labelledby={group.label ? labelId : undefined}>
					{#if group.label}
						<Sidebar.GroupLabel id={labelId}>{group.label}</Sidebar.GroupLabel>
					{/if}
					<Sidebar.GroupContent>
						<Sidebar.Menu>
							{#each group.items as item (item.name)}
								<Sidebar.MenuItem>
									<Sidebar.MenuButton href={item.href} isActive={item.active}>
										{#if item.icon}
											<ResourceIcon icon={item.icon} />
										{/if}
										<span>{item.label}</span>
									</Sidebar.MenuButton>
								</Sidebar.MenuItem>
							{/each}
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>
			{/each}
		</nav>
	</Sidebar.Content>

	{#if userMenu}
		<Sidebar.Footer>{@render userMenu()}</Sidebar.Footer>
	{/if}
</Sidebar.Root>

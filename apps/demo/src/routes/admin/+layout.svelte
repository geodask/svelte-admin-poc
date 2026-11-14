<script lang="ts">
	import PanelsTopLeftIcon from '@lucide/svelte/icons/panels-top-left';
	import { AdminShell } from '@svelte-admin/theme-shadcn';
	import { admin } from '#lib/admin.ts';

	let { children } = $props();

	// The demo has no sign-in, so its user menu shows a fixed demo user.
	const user = { name: 'Ada Lovelace', email: 'ada@example.com' };
	const initials = user.name
		.split(' ')
		.map((word) => word[0])
		.join('');
</script>

<AdminShell {admin}>
	{#snippet brand()}
		<span
			class="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground"
		>
			<PanelsTopLeftIcon class="size-4" />
		</span>
		Svelte Admin Demo
	{/snippet}

	{#snippet userMenu()}
		<!-- A <details> menu, so it opens without JavaScript too. -->
		<details class="group relative">
			<summary
				class="flex cursor-pointer list-none items-center gap-2 rounded-md p-2 text-sm hover:bg-sidebar-accent [&::-webkit-details-marker]:hidden"
			>
				<span
					aria-hidden="true"
					class="flex size-8 items-center justify-center rounded-lg bg-sidebar-accent font-medium"
				>
					{initials}
				</span>
				<span class="grid flex-1 leading-tight">
					<span class="truncate font-medium">{user.name}</span>
					<span class="truncate text-xs text-muted-foreground">{user.email}</span>
				</span>
			</summary>
			<div
				class="absolute inset-x-0 bottom-full mb-1 rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md"
			>
				<p class="px-2 py-1.5 text-xs text-muted-foreground">The demo has no sign-in.</p>
				<button type="button" disabled class="w-full rounded-sm px-2 py-1.5 text-start opacity-50">
					Sign out
				</button>
			</div>
		</details>
	{/snippet}

	{@render children()}
</AdminShell>

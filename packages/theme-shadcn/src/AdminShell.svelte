<!--
	The admin shell: a sidebar of every Resource, grouped as admin.ts defines, a header with a
	breadcrumb, and the page's content. The app passes its admin from admin.ts and its own brand
	and user menu as snippets. Every link is built from the base path in admin.ts, and the shell
	works the same without JavaScript.
-->
<script lang="ts">
	import { createShell, type ShellAdmin } from '@svelte-admin/core/views';
	import type { Snippet } from 'svelte';
	import AdminHeader from './AdminHeader.svelte';
	import AdminSidebar from './AdminSidebar.svelte';
	import * as Sidebar from './components/ui/sidebar/index.ts';

	let {
		admin,
		brand,
		userMenu,
		children
	}: {
		/** The admin from admin.ts. */
		admin: ShellAdmin;
		/** The app's brand, at the top of the sidebar. */
		brand?: Snippet;
		/** The app's user menu, at the foot of the sidebar. */
		userMenu?: Snippet;
		children: Snippet;
	} = $props();

	const shell = $derived(createShell(admin));
</script>

<Sidebar.Provider data-admin-shell class="bg-background text-foreground">
	<AdminSidebar {shell} {brand} {userMenu} />
	<Sidebar.Inset>
		<AdminHeader {shell} />
		<main class="mx-auto w-full max-w-7xl p-4 lg:p-6">
			{@render children()}
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>

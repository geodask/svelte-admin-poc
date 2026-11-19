<!--
	The admin shell: a sidebar of every Resource, grouped as admin.ts defines, a header with a
	breadcrumb, and the page's content. The app passes its admin from admin.ts and its own brand
	and user menu as snippets. Every link is built from the base path in admin.ts, and the shell
	works the same without JavaScript. On first render it checks that every Kind a Field names is
	the Theme's or the admin's, and throws an error naming the Resource, the Field and the Kind
	otherwise.
-->
<script lang="ts">
	import { assertNamedKinds, type Admin } from '@svelte-admin/core';
	import { createShell } from '@svelte-admin/core/views';
	import type { Snippet } from 'svelte';
	import AdminHeader from './AdminHeader.svelte';
	import AdminSidebar from './AdminSidebar.svelte';
	import * as Sidebar from './components/ui/sidebar/index.ts';
	import { themeKinds } from './kinds.ts';

	let {
		admin,
		brand,
		userMenu,
		children
	}: {
		/** The admin from admin.ts. */
		admin: Admin;
		/** The app's brand, at the top of the sidebar, inside a link to the admin's first Resource. */
		brand?: Snippet;
		/** The app's user menu, at the foot of the sidebar. */
		userMenu?: Snippet;
		children: Snippet;
	} = $props();

	// Once, on first render: the admin's Resources and Kinds don't change.
	// svelte-ignore state_referenced_locally
	assertNamedKinds(admin, themeKinds);

	const shell = $derived(createShell(admin));
</script>

<Sidebar.Provider data-admin-shell {...shell.linkOptions} class="bg-background text-foreground">
	<AdminSidebar {shell} {brand} {userMenu} />
	<Sidebar.Inset>
		<AdminHeader {admin} {shell} />
		<main class="mx-auto w-full max-w-7xl p-4 lg:p-6">
			{@render children()}
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>

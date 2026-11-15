<!--
	A replaced View: users as a card grid instead of the stock list View. A route at a Resource's
	list path wins over the admin's `[resource]` route. It keeps the list's URL state, search,
	paging and selection through the core's `createListView`, and matches the admin through the
	Theme's exported parts.
-->
<script lang="ts">
	import { createListView } from '@svelte-admin/core/views';
	import { FieldCell, Pager, SelectionCheckbox, Toolbar } from '@svelte-admin/theme-shadcn';
	import { users } from '#lib/resources/users.ts';
	import * as remote from '#lib/resources/users.remote.ts';

	const view = createListView(users, remote);
	const result = $derived(await view.query);
	const details = view.fields.filter((field) => field.key !== 'id' && field !== view.linkField);
	const valueOf = (user: Record<string, unknown>, key: string) => user[key];
</script>

<svelte:head><title>Users</title></svelte:head>

<div class="flex flex-col gap-4">
	<h1 class="text-2xl font-semibold tracking-tight">Users</h1>
	<Toolbar {view} />
	<ul aria-label="Users" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
		{#each result.data as user (user.id)}
			<li class="flex flex-col gap-3 rounded-lg border p-4">
				<div class="flex items-center gap-3">
					<SelectionCheckbox
						label="Select {user.name}"
						checked={view.selection.has(user.id)}
						onchange={(checked) => view.selection.toggle(user.id, checked)}
					/>
					<FieldCell field={view.linkField} value={user.name} href={view.recordHref(user)} />
				</div>
				<dl class="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
					{#each details as field (field.key)}
						<dt class="text-muted-foreground">{field.label}</dt>
						<dd><FieldCell {field} value={valueOf(user, field.key)} /></dd>
					{/each}
				</dl>
			</li>
		{:else}
			<li class="text-muted-foreground">
				{view.params.search ? `No users match “${view.params.search}”.` : 'No users yet.'}
			</li>
		{/each}
	</ul>
	<Pager {view} {result} />
</div>

<!--
	The shell's header: a breadcrumb with the current Resource's label and, on a detail View, the
	record's Record title, or "New" on the create View. On the edit View it reads Resource /
	Record title / Edit, with the Record title linking to the detail View. Off the list View the
	label links back to the list.
-->
<script lang="ts">
	import { idPathSegment } from '@svelte-admin/core';
	import type { ShellState } from '@svelte-admin/core/views';
	import * as Breadcrumb from './components/ui/breadcrumb/index.ts';
	import RecordCrumb from './RecordCrumb.svelte';

	let { shell }: { shell: ShellState } = $props();
</script>

<header class="flex h-12 shrink-0 items-center gap-2 border-b px-4 lg:px-6">
	{#if shell.here}
		{@const { resource, listHref, view, id } = shell.here}
		<Breadcrumb.Root>
			<Breadcrumb.List>
				<Breadcrumb.Item>
					{#if view === 'create' || id !== undefined}
						<Breadcrumb.Link href={listHref}>{resource.label}</Breadcrumb.Link>
					{:else}
						<Breadcrumb.Page>{resource.label}</Breadcrumb.Page>
					{/if}
				</Breadcrumb.Item>
				{#if view === 'create'}
					<Breadcrumb.Separator />
					<Breadcrumb.Item>
						<Breadcrumb.Page>New</Breadcrumb.Page>
					</Breadcrumb.Item>
				{:else if id !== undefined}
					<Breadcrumb.Separator />
					<Breadcrumb.Item>
						<RecordCrumb
							here={shell.here}
							{id}
							href={view === 'edit' ? `${listHref}/${idPathSegment(id)}` : undefined}
						/>
					</Breadcrumb.Item>
					{#if view === 'edit'}
						<Breadcrumb.Separator />
						<Breadcrumb.Item>
							<Breadcrumb.Page>Edit</Breadcrumb.Page>
						</Breadcrumb.Item>
					{/if}
				{/if}
			</Breadcrumb.List>
		</Breadcrumb.Root>
	{/if}
</header>

<!--
	The shell's header: a breadcrumb with the current Resource's label and, on a detail View, the
	record's Record title. On a detail View the label links back to the list.
-->
<script lang="ts">
	import type { ShellState } from '@svelte-admin/core/views';
	import * as Breadcrumb from './components/ui/breadcrumb/index.ts';
	import RecordCrumb from './RecordCrumb.svelte';

	let { shell }: { shell: ShellState } = $props();
</script>

<header class="flex h-12 shrink-0 items-center gap-2 border-b px-4 lg:px-6">
	{#if shell.here}
		{@const { resource, listHref, id } = shell.here}
		<Breadcrumb.Root>
			<Breadcrumb.List>
				<Breadcrumb.Item>
					{#if id === undefined}
						<Breadcrumb.Page>{resource.label}</Breadcrumb.Page>
					{:else}
						<Breadcrumb.Link href={listHref}>{resource.label}</Breadcrumb.Link>
					{/if}
				</Breadcrumb.Item>
				{#if id !== undefined}
					<Breadcrumb.Separator />
					<Breadcrumb.Item>
						<RecordCrumb here={shell.here} {id} />
					</Breadcrumb.Item>
				{/if}
			</Breadcrumb.List>
		</Breadcrumb.Root>
	{/if}
</header>

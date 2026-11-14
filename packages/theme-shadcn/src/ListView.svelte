<!--
	The list View: one page of a Resource's records in a table, with a pager. It takes the
	Resource and its remote functions as props, so a route passes them from admin.ts. It shows
	each Field the Resource puts on the list, in schema order, by its Kind, and each row links to
	its record's detail View. The page, page size
	and search live in the URL, through the core's headless `createListView`.
-->
<script lang="ts">
	import type { Resource, ResourceRemote } from '@svelte-admin/core';
	import { createListView } from '@svelte-admin/core/views';
	import { getCoreRowModel, type ColumnDef } from '@tanstack/table-core';
	import FieldCell from './FieldCell.svelte';
	import Pager from './Pager.svelte';
	import Toolbar from './Toolbar.svelte';
	import {
		createSvelteTable,
		FlexRender,
		renderComponent
	} from './components/ui/data-table/index.ts';
	import * as Table from './components/ui/table/index.ts';

	type Row = Record<string, unknown>;

	let { resource, remote }: { resource: Resource; remote: ResourceRemote } = $props();

	// Derived, so the list View follows the Resource when the route switches to another one.
	const view = $derived(createListView(resource, remote));
	const result = $derived(await view.query);
	const emptyMessage = $derived.by(() => {
		const records = resource.label.toLowerCase();
		if (view.params.search !== undefined) return `No ${records} match “${view.params.search}”.`;
		return `No ${records} ${view.params.page > 1 ? 'on this page' : 'yet'}.`;
	});

	const columns = $derived<ColumnDef<Row>[]>(
		view.fields.map((field) => ({
			// An accessor function, not `accessorKey`, which would read a dotted key as a path.
			id: field.key,
			accessorFn: (row) => row[field.key],
			header: field.label,
			cell: ({ getValue, row }) =>
				renderComponent(FieldCell, {
					field,
					value: getValue(),
					// One cell per row links to the record's detail View.
					href: field === view.linkField ? view.recordHref(row.original) : undefined
				})
		}))
	);

	const table = createSvelteTable<Row>({
		get data() {
			return result.data;
		},
		get columns() {
			return columns;
		},
		manualPagination: true,
		getRowId: (row) => String(row.id),
		getCoreRowModel: getCoreRowModel()
	});
</script>

<svelte:head>
	<title>{resource.label}</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<h1 class="text-2xl font-semibold tracking-tight">{resource.label}</h1>

	<Toolbar {view} />

	<div class="overflow-hidden rounded-lg border">
		<Table.Root>
			<Table.Header class="bg-muted">
				{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
					<Table.Row>
						{#each headerGroup.headers as header (header.id)}
							<Table.Head colspan={header.colSpan}>
								{#if !header.isPlaceholder}
									<FlexRender
										content={header.column.columnDef.header}
										context={header.getContext()}
									/>
								{/if}
							</Table.Head>
						{/each}
					</Table.Row>
				{/each}
			</Table.Header>
			<Table.Body>
				{#each table.getRowModel().rows as row (row.id)}
					<Table.Row>
						{#each row.getVisibleCells() as cell (cell.id)}
							<Table.Cell>
								<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
							</Table.Cell>
						{/each}
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={columns.length} class="h-24 text-center text-muted-foreground">
							{emptyMessage}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>

	<Pager {view} {result} />
</div>

<!--
	The list View's content: the toolbar, one page of records in a table, and the pager. It awaits
	the page, so the list View renders it inside its boundary. While a new page loads (after a
	page change or a search), the old rows stay and a small indicator shows.
-->
<script lang="ts">
	import type { ListViewState } from '@svelte-admin/core/views';
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

	let { view }: { view: ListViewState } = $props();

	const result = $derived(await view.query);
	const emptyMessage = $derived.by(() => {
		const records = view.resource.label.toLowerCase();
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

<div class="flex flex-col gap-4">
	<div class="flex min-h-9 flex-wrap items-center justify-between gap-4">
		<Toolbar {view} />
		{#if $effect.pending() > 0}
			<p role="status" class="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
				<span
					aria-hidden="true"
					class="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
				></span>
				Refreshing…
			</p>
		{/if}
	</div>

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

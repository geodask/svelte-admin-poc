<!--
	The list View's content: one page of records in a table, and the pager. It awaits
	the page, so the list View renders it inside its boundary. While a new page loads (after a
	page change or a search), the old rows stay and a small indicator shows.

	The first cell of each row is a checkbox that selects the row, and the one in the header
	selects or clears every row on the page. The selection is the core's, so it belongs to this
	Resource.
-->
<script lang="ts">
	import { recordTitle } from '@svelte-admin/core';
	import type { ListViewState } from '@svelte-admin/core/views';
	import { getCoreRowModel, type ColumnDef } from '@tanstack/table-core';
	import FieldCell from './FieldCell.svelte';
	import Pager from './Pager.svelte';
	import SelectionCheckbox from './SelectionCheckbox.svelte';
	import {
		createSvelteTable,
		FlexRender,
		renderComponent
	} from './components/ui/data-table/index.ts';
	import * as Table from './components/ui/table/index.ts';

	type Row = Record<string, unknown>;

	let { view }: { view: ListViewState } = $props();

	const result = $derived(await view.query);
	const selection = $derived(view.selection);
	/** The ids of the records on this page, for the select-all checkbox. */
	const pageIds = $derived(result.data.map((record) => idOf(record)));
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
		getRowId: (row) => String(idOf(row)),
		getCoreRowModel: getCoreRowModel()
	});

	function idOf(record: Row): string | number {
		return record.id as string | number;
	}
</script>

<div class="relative flex flex-col gap-4">
	{#if $effect.pending() > 0}
		<!-- In the row above the table (the toolbar's, else the heading's), so nothing shifts. -->
		<p
			role="status"
			class="absolute right-0 bottom-full mb-4 flex h-9 items-center gap-2 text-sm text-muted-foreground"
		>
			<span
				aria-hidden="true"
				class="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
			></span>
			Refreshing…
		</p>
	{/if}

	<div class="overflow-hidden rounded-lg border">
		<Table.Root>
			<Table.Header class="bg-muted">
				{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
					<Table.Row>
						<Table.Head class="w-10">
							<span class="sr-only">Select</span>
							<SelectionCheckbox
								label="Select all on this page"
								checked={selection.allSelected(pageIds)}
								indeterminate={selection.someSelected(pageIds)}
								disabled={pageIds.length === 0}
								onchange={(checked) => selection.setAll(pageIds, checked)}
							/>
						</Table.Head>
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
					{@const id = idOf(row.original)}
					{@const selected = selection.has(id)}
					<Table.Row data-state={selected ? 'selected' : undefined}>
						<Table.Cell>
							<SelectionCheckbox
								label="Select {recordTitle(view.resource, row.original)}"
								checked={selected}
								onchange={(checked) => selection.toggle(id, checked)}
							/>
						</Table.Cell>
						{#each row.getVisibleCells() as cell (cell.id)}
							<Table.Cell>
								<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
							</Table.Cell>
						{/each}
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={columns.length + 1} class="h-24 text-center text-muted-foreground">
							{emptyMessage}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>

	<Pager {view} {result} />
</div>

<!--
	The list View: the first page of a Resource's records in a table. It takes the Resource and
	its remote functions as props, so a route (or a replaced View) passes them from admin.ts.
	Field values show as plain text for now; display by Kind comes with Field metadata.
-->
<script lang="ts">
	import { DEFAULT_PER_PAGE, type Resource, type ResourceRemote } from '@svelte-admin/core';
	import { getCoreRowModel, type ColumnDef } from '@tanstack/table-core';
	import { createSvelteTable, FlexRender } from './components/ui/data-table/index.ts';
	import * as Table from './components/ui/table/index.ts';

	type Row = Record<string, unknown>;

	let { resource, remote }: { resource: Resource; remote: ResourceRemote } = $props();

	const result = $derived(await remote.getList({ page: 1, perPage: DEFAULT_PER_PAGE }));

	const columns = $derived<ColumnDef<Row>[]>(
		Object.keys(resource.schema.shape).map((key) => ({
			accessorKey: key,
			header: key,
			cell: ({ getValue }) => plainText(getValue())
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

	function plainText(value: unknown): string {
		if (value === null || value === undefined) return '';
		if (Array.isArray(value)) return value.join(', ');
		return String(value);
	}
</script>

<svelte:head>
	<title>{resource.label}</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<h1 class="text-2xl font-semibold tracking-tight">{resource.label}</h1>

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
							No {resource.label.toLowerCase()} yet.
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
</div>

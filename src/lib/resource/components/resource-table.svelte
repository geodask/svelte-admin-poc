<script lang="ts" generics="TData extends { id: string | number }">
	import {
		createSvelteTable,
		FlexRender,
		renderComponent
	} from '$lib/components/ui/data-table/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import {
		getCoreRowModel,
		getFilteredRowModel,
		getPaginationRowModel,
		getSortedRowModel,
		type ColumnFiltersState,
		type PaginationState,
		type SortingState,
		type VisibilityState
	} from '@tanstack/table-core';
	import ResourceTableActions from './resource-table-actions.svelte';
	import ResourceTablePagination from './resource-table-pagination.svelte';
	import ResourceTableToolbar from './resource-table-toolbar.svelte';
	import type { ColumnDef, ResourceLike } from './types';

	interface Props {
		resource: ResourceLike<TData>;
		paginated?: boolean;
		pageSize?: number;
		showActions?: boolean;
	}

	let { resource, paginated = true, pageSize = 10, showActions = true }: Props = $props();

	// Async data fetch as a derived expression
	let data = $derived(await resource.remotes.getMany({}));

	const columns = $derived.by(() => {
		const baseColumns = (resource.metadata.columns ??
			Object.keys((resource.metadata.schema as { shape: Record<string, unknown> }).shape).map(
				(key) => ({
					accessorKey: key,
					header: key.charAt(0).toUpperCase() + key.slice(1)
				})
			)) as ColumnDef<TData>[];

		// Add actions column if showActions is true
		if (showActions) {
			return [
				...baseColumns,
				{
					id: 'actions',
					header: '',
					cell: ({ row }: { row: { original: TData } }) => {
						return renderComponent(ResourceTableActions, { resource, row: row.original });
					}
				}
			];
		}

		return baseColumns;
	});

	let pagination = $derived<PaginationState>({ pageIndex: 0, pageSize });
	let sorting = $state<SortingState>([]);
	let columnFilters = $state<ColumnFiltersState>([]);
	let columnVisibility = $state<VisibilityState>({});
	let globalFilter = $state('');

	const table = createSvelteTable({
		get data() {
			return data.data;
		},
		get columns() {
			return columns;
		},
		state: {
			get pagination() {
				return pagination;
			},
			get sorting() {
				return sorting;
			},
			get columnVisibility() {
				return columnVisibility;
			},
			get columnFilters() {
				return columnFilters;
			},
			get globalFilter() {
				return globalFilter;
			}
		},
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		getRowId: (row, index) => ((row as any).id ?? index).toString(),
		getCoreRowModel: getCoreRowModel(),
		get getPaginationRowModel() {
			return paginated ? getPaginationRowModel() : undefined;
		},
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onPaginationChange: (updater) => {
			if (typeof updater === 'function') {
				pagination = updater(pagination);
			} else {
				pagination = updater;
			}
		},
		onSortingChange: (updater) => {
			if (typeof updater === 'function') {
				sorting = updater(sorting);
			} else {
				sorting = updater;
			}
		},
		onColumnFiltersChange: (updater) => {
			if (typeof updater === 'function') {
				columnFilters = updater(columnFilters);
			} else {
				columnFilters = updater;
			}
		},
		onColumnVisibilityChange: (updater) => {
			if (typeof updater === 'function') {
				columnVisibility = updater(columnVisibility);
			} else {
				columnVisibility = updater;
			}
		},
		onGlobalFilterChange: (updater) => {
			if (typeof updater === 'function') {
				globalFilter = updater(globalFilter);
			} else {
				globalFilter = updater;
			}
		}
	});
</script>

<div class="flex flex-col gap-4">
	<!-- Toolbar -->
	<ResourceTableToolbar tableFn={() => table} />

	<!-- Table -->
	<div class="overflow-hidden rounded-lg border">
		<Table.Root>
			<Table.Header class="sticky top-0 z-10 bg-muted">
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
				{#if table.getRowModel().rows?.length}
					{#each table.getRowModel().rows as row (row.id)}
						<Table.Row data-state={row.getIsSelected() && 'selected'}>
							{#each row.getVisibleCells() as cell (cell.id)}
								<Table.Cell>
									<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
								</Table.Cell>
							{/each}
						</Table.Row>
					{/each}
				{:else}
					<Table.Row>
						<Table.Cell colspan={columns.length} class="h-24 text-center">No results.</Table.Cell>
					</Table.Row>
				{/if}
			</Table.Body>
		</Table.Root>
	</div>

	<!-- Pagination -->
	{#if paginated}
		<ResourceTablePagination tableFn={() => table} />
	{/if}
</div>

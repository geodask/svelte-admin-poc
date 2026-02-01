<script lang="ts" module>
	import type { ColumnDef } from '@tanstack/table-core';
	import type { GetManyParams, GetManyResponse } from '../schemas';

	export type { ColumnDef };

	// Type for the resource object from useResource()
	export type ResourceLike<TData extends Record<string, unknown>> = {
		metadata: {
			name: string;
			label: string;
			columns?: ColumnDef<TData>[];
			schema: unknown;
		};
		remotes: {
			getMany: (params: GetManyParams) => Promise<GetManyResponse<TData>>;
		};
	};
</script>

<script lang="ts" generics="TData extends Record<string, unknown>">
	import { Button } from '$lib/components/ui/button/index.js';
	import { createSvelteTable, FlexRender } from '$lib/components/ui/data-table/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import LayoutColumnsIcon from '@tabler/icons-svelte/icons/layout-columns';
	import ChevronDownIcon from '@tabler/icons-svelte/icons/chevron-down';
	import ChevronLeftIcon from '@tabler/icons-svelte/icons/chevron-left';
	import ChevronRightIcon from '@tabler/icons-svelte/icons/chevron-right';
	import ChevronsLeftIcon from '@tabler/icons-svelte/icons/chevrons-left';
	import ChevronsRightIcon from '@tabler/icons-svelte/icons/chevrons-right';
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

	interface Props {
		resource: ResourceLike<TData>;
		searchable?: boolean;
		searchColumn?: string;
		paginated?: boolean;
		pageSize?: number;
	}

	let {
		resource,
		searchable = false,
		searchColumn,
		paginated = true,
		pageSize = 10
	}: Props = $props();

	// Derive columns from resource metadata, or auto-generate from schema keys
	const columns = $derived<ColumnDef<TData>[]>(
		resource.metadata.columns ??
			Object.keys((resource.metadata.schema as { shape: Record<string, unknown> }).shape).map(
				(key) => ({
					accessorKey: key,
					header: key.charAt(0).toUpperCase() + key.slice(1)
				})
			)
	);

	let data = $state<TData[]>([]);
	let loading = $state(true);

	// Fetch data on mount
	$effect(() => {
		loading = true;
		resource.remotes
			.getMany({})
			.then((response) => {
				data = response.data;
			})
			.finally(() => {
				loading = false;
			});
	});

	let pagination = $derived<PaginationState>({ pageIndex: 0, pageSize });
	let sorting = $state<SortingState>([]);
	let columnFilters = $state<ColumnFiltersState>([]);
	let columnVisibility = $state<VisibilityState>({});
	let globalFilter = $state('');

	const table = createSvelteTable({
		get data() {
			return data;
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
		getRowId: (row, index) => (row.id ?? index).toString(),
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
	<div class="flex items-center justify-between px-4 lg:px-6">
		{#if searchable}
			<Input
				placeholder="Search..."
				class="max-w-sm"
				value={searchColumn
					? ((table.getColumn(searchColumn)?.getFilterValue() as string) ?? '')
					: globalFilter}
				oninput={(e) => {
					const value = e.currentTarget.value;
					if (searchColumn) {
						table.getColumn(searchColumn)?.setFilterValue(value);
					} else {
						globalFilter = value;
					}
				}}
			/>
		{:else}
			<div></div>
		{/if}

		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button variant="outline" size="sm" {...props}>
						<LayoutColumnsIcon />
						<span class="hidden lg:inline">Customize Columns</span>
						<span class="lg:hidden">Columns</span>
						<ChevronDownIcon />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" class="w-56">
				{#each table
					.getAllColumns()
					.filter((col) => typeof col.accessorFn !== 'undefined' && col.getCanHide()) as column (column.id)}
					<DropdownMenu.CheckboxItem
						class="capitalize"
						checked={column.getIsVisible()}
						onCheckedChange={(value) => column.toggleVisibility(!!value)}
					>
						{column.id}
					</DropdownMenu.CheckboxItem>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>

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
		<div class="flex items-center justify-between px-4">
			<div class="hidden flex-1 text-sm text-muted-foreground lg:flex">
				{table.getFilteredRowModel().rows.length} row(s) total
			</div>
			<div class="flex w-full items-center gap-8 lg:w-fit">
				<div class="hidden items-center gap-2 lg:flex">
					<Label for="rows-per-page" class="text-sm font-medium">Rows per page</Label>
					<Select.Root
						type="single"
						value={`${table.getState().pagination.pageSize}`}
						onValueChange={(v) => table.setPageSize(Number(v))}
					>
						<Select.Trigger size="sm" class="w-20" id="rows-per-page">
							{table.getState().pagination.pageSize}
						</Select.Trigger>
						<Select.Content side="top">
							{#each [10, 20, 30, 40, 50] as size (size)}
								<Select.Item value={size.toString()}>
									{size}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="flex w-fit items-center justify-center text-sm font-medium">
					Page {table.getState().pagination.pageIndex + 1} of
					{table.getPageCount()}
				</div>
				<div class="ms-auto flex items-center gap-2 lg:ms-0">
					<Button
						variant="outline"
						class="hidden h-8 w-8 p-0 lg:flex"
						onclick={() => table.setPageIndex(0)}
						disabled={!table.getCanPreviousPage()}
					>
						<span class="sr-only">Go to first page</span>
						<ChevronsLeftIcon />
					</Button>
					<Button
						variant="outline"
						class="size-8"
						size="icon"
						onclick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						<span class="sr-only">Go to previous page</span>
						<ChevronLeftIcon />
					</Button>
					<Button
						variant="outline"
						class="size-8"
						size="icon"
						onclick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						<span class="sr-only">Go to next page</span>
						<ChevronRightIcon />
					</Button>
					<Button
						variant="outline"
						class="hidden size-8 lg:flex"
						size="icon"
						onclick={() => table.setPageIndex(table.getPageCount() - 1)}
						disabled={!table.getCanNextPage()}
					>
						<span class="sr-only">Go to last page</span>
						<ChevronsRightIcon />
					</Button>
				</div>
			</div>
		</div>
	{/if}
</div>

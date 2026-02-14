<script lang="ts" generics="TData extends { id: string | number }">
	import {
		createSvelteTable,
		FlexRender,
		renderComponent
	} from '$lib/components/ui/data-table/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import type { ColumnDef } from '@tanstack/table-core';
	import { getCoreRowModel, type SortingState, type VisibilityState } from '@tanstack/table-core';
	import { Debounced } from 'runed';
	import { useSearchParams } from 'runed/kit';
	import z from 'zod';
	import ResourceTableActions from './resource-table-actions.svelte';
	import ResourceTablePagination from './resource-table-pagination.svelte';
	import ResourceTableToolbar from './resource-table-toolbar.svelte';
	import type { ResourceLike } from './types';
	import { getResourceContext } from './resource-provider.svelte';

	interface Props {
		showActions?: boolean;
	}

	let { showActions = true }: Props = $props();

	const ctx = getResourceContext();
	const resource = $derived(ctx.resource as ResourceLike<TData>);

	const params = useSearchParams(
		z.object({
			q: z.string().default(''),
			limit: z.coerce.number().default(10),
			skip: z.coerce.number().default(0)
		})
	);

	const pageIndex = $derived(params.skip / params.limit);
	const pageSize = $derived(params.limit);

	const debouncedSearch = new Debounced(() => params.q, 200);

	const getMany = $derived(
		resource.remotes.getMany({
			search: debouncedSearch.current,
			pagination: {
				pageIndex: $state.eager(pageIndex),
				pageSize: $state.eager(pageSize)
			}
		})
	);

	// Register the active getMany query in context for invalidation
	$effect.pre(() => {
		ctx.queries.getMany = getMany;
	});

	const data = $derived(await getMany);

	const columns = $derived.by(() => {
		const baseColumns = (resource.metadata.columns ??
			Object.keys(
				(resource.metadata.schema as unknown as { shape: Record<string, unknown> }).shape
			).map((key) => ({
				accessorKey: key,
				header: key.charAt(0).toUpperCase() + key.slice(1)
			}))) as ColumnDef<TData>[];

		// Add actions column if showActions is true
		if (showActions) {
			return [
				...baseColumns,
				{
					id: 'actions',
					header: '',
					cell: ({ row }: { row: { original: TData } }) => {
						return renderComponent(ResourceTableActions, {
							row: row.original
						});
					}
				}
			];
		}

		return baseColumns;
	});

	let sorting = $state<SortingState>([]);
	let columnVisibility = $state<VisibilityState>({});

	const table = createSvelteTable({
		get rowCount() {
			return data.total;
		},
		get pageCount() {
			return data.pageCount;
		},
		get data() {
			return data.data;
		},
		get columns() {
			return columns;
		},
		state: {
			get pagination() {
				return {
					pageIndex,
					pageSize
				};
			},
			get sorting() {
				return sorting;
			},
			get columnVisibility() {
				return columnVisibility;
			},
			get globalFilter() {
				return params.q;
			}
		},
		manualPagination: true,
		manualFiltering: true,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		getRowId: (row, index) => ((row as any).id ?? index).toString(),
		getCoreRowModel: getCoreRowModel(),
		onPaginationChange: (updater) => {
			if (typeof updater === 'function') {
				const oldState = {
					pageIndex,
					pageSize
				};
				const newPagination = updater(oldState);
				params.update({
					limit: newPagination.pageSize,
					skip: newPagination.pageIndex * newPagination.pageSize
				});

				if (newPagination.pageSize !== oldState.pageSize) {
					table.resetPageIndex();
				}
			} else {
				params.update({
					limit: updater.pageSize,
					skip: updater.pageIndex * updater.pageSize
				});
			}
		},
		onSortingChange: (updater) => {
			if (typeof updater === 'function') {
				sorting = updater(sorting);
			} else {
				sorting = updater;
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
			const newFilter = typeof updater === 'function' ? updater(params.q) : updater;
			params.update({ q: newFilter });
			table.resetPageIndex();
		}
	});
</script>

<div class="flex flex-col gap-4">
	<!-- Toolbar -->
	<ResourceTableToolbar {table} />

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

	<ResourceTablePagination {table} />
</div>

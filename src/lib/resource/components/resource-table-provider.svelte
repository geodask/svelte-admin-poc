<script lang="ts" module>
	import type { Table as TanstackTable } from '@tanstack/table-core';
	import { createContext } from 'svelte';

	export type ResourceTableProvider<TData = any> = {
		table: TanstackTable<TData>;
		rowSelection: RowSelectionState;
	};

	export const [getTableContext, setTableContext] = createContext<ResourceTableProvider>();
</script>

<script lang="ts" generics="TData extends { id: string | number }">
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
	import { createSvelteTable, renderComponent } from '$lib/components/ui/data-table/index.js';
	import type { ColumnDef, RowSelectionState } from '@tanstack/table-core';
	import { getCoreRowModel, type SortingState, type VisibilityState } from '@tanstack/table-core';
	import { Debounced } from 'runed';
	import { useSearchParams } from 'runed/kit';
	import z from 'zod';
	import { fieldsForView } from '../field-registry/index.js';
	import { getResourceContext } from './resource-provider.svelte';
	import ResourceTableActions from './resource-table-actions.svelte';
	import type { ResourceLike } from './types';

	interface Props {
		showActions?: boolean;
		children: import('svelte').Snippet;
	}

	const { showActions, children }: Props = $props();

	const ctx = getResourceContext();
	const resource = $derived(ctx.resource as ResourceLike<TData>);

	const context = $state({
		table: null as unknown as TanstackTable<TData>,
		rowSelection: {}
	});
	setTableContext(context);

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
	const listFields = $derived(fieldsForView(resource.metadata.schema as z.ZodObject, 'list'));

	const columns = $derived.by(() => {
		const baseColumns = listFields.map((field) => ({
			accessorKey: field.key,
			header: field.label,
			cell: ({ getValue, row }: { getValue: () => unknown; row: { original: TData } }) => {
				const value = getValue();

				if (field.render) {
					return field.render({
						key: field.key,
						value,
						row: row.original as Record<string, unknown>
					});
				}

				if (value == null) return '';
				if (Array.isArray(value)) return value.join(', ');
				if (typeof value === 'object') return JSON.stringify(value);
				return String(value);
			}
		})) as ColumnDef<TData>[];

		if (resource.metadata.selectable) {
			baseColumns.unshift({
				id: 'select',
				header: ({ table }) =>
					renderComponent(Checkbox, {
						checked: table.getIsAllPageRowsSelected(),
						indeterminate: table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(),
						onCheckedChange: (value) => table.toggleAllPageRowsSelected(!!value),
						'aria-label': 'Select all'
					}),
				cell: ({ row }) =>
					renderComponent(Checkbox, {
						checked: row.getIsSelected(),
						onCheckedChange: (value) => row.toggleSelected(!!value),
						'aria-label': 'Select row'
					}),
				enableSorting: false,
				enableHiding: false
			});
		}

		if (showActions) {
			baseColumns.push({
				id: 'actions',
				header: '',
				cell: ({ row }: { row: { original: TData } }) => {
					return renderComponent(ResourceTableActions, {
						row: row.original
					});
				},
				enableSorting: false,
				enableHiding: false
			});
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
			},
			get rowSelection() {
				return context.rowSelection;
			}
		},
		manualPagination: true,
		manualFiltering: true,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		getRowId: (row) => row.id.toString(),
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
		},
		onRowSelectionChange: (updater) => {
			if (typeof updater === 'function') {
				context.rowSelection = updater(context.rowSelection || {});
			} else {
				context.rowSelection = updater;
			}
		}
	});

	context.table = table;
</script>

{#if table}
	{@render children()}
{/if}

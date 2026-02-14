<script lang="ts" generics="TData extends { id: string | number}">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import {
		ChevronDownIcon,
		Columns2Icon,
		DownloadIcon,
		EllipsisVerticalIcon,
		FileBracesIcon,
		FileSpreadsheetIcon,
		PlusIcon,
		RotateCwIcon,
		Trash2Icon
	} from '@lucide/svelte';
	import type { Table } from '@tanstack/table-core';
	import { toast } from 'svelte-sonner';
	import { exportData, type ExportColumn, type ExportFormat } from '../export';
	import { getResourceContext } from './resource-provider.svelte';
	import { getTableContext } from './resource-table-provider.svelte';

	type Props = {
		table: Table<TData>;
	};

	const ctx = getResourceContext();
	const tableCtx = getTableContext();
	const table = $derived(tableCtx.table);
	const rowSelection = $derived(tableCtx.rowSelection);

	const searchable = $derived(ctx.resource.metadata.searchable);
	const exportable = $derived(ctx.resource.metadata.exportable);

	let exporting = $state(false);

	function getExportColumns(): ExportColumn[] {
		return table
			.getAllColumns()
			.filter((col) => typeof col.accessorFn !== 'undefined')
			.map((col) => ({
				key: col.id,
				header: typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id
			}));
	}

	function handleExportCurrentView(format: ExportFormat) {
		const rows = table.getRowModel().rows.map((r) => r.original as Record<string, unknown>);
		const columns = getExportColumns();
		exportData(rows, columns, `${ctx.resource.metadata.name}-current`, format);
		toast.success(`Exported ${rows.length} rows as ${format.toUpperCase()}`);
	}

	async function handleExportAll(format: ExportFormat) {
		exporting = true;
		try {
			const result = await ctx.resource.remotes.getMany({
				pagination: { pageSize: 10000, mode: 'off' }
			});
			const columns = getExportColumns();
			exportData(
				result.data as Record<string, unknown>[],
				columns,
				`${ctx.resource.metadata.name}-all`,
				format
			);
			toast.success(`Exported ${result.data.length} rows as ${format.toUpperCase()}`);
		} catch (e) {
			toast.error('Failed to export all data');
			console.error(e);
		} finally {
			exporting = false;
		}
	}
</script>

<div class="flex items-center justify-between">
	<div class="flex grow items-center gap-2">
		{#if searchable}
			<Input
				placeholder="Search..."
				class="max-w-sm"
				bind:value={
					() => {
						return table.getState().globalFilter;
					},
					(value) => {
						table.setGlobalFilter(value);
					}
				}
			/>
		{/if}

		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button size="sm" variant="ghost" class="border border-dashed" {...props}>
						<PlusIcon />
						Add Filter
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content>
				<DropdownMenu.Item></DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>

	<div class="flex items-center gap-1">
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button size="sm" variant="outline" {...props}>
						<EllipsisVerticalIcon class="size-4" />
						Actions
						<ChevronDownIcon />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				<DropdownMenu.Item
					disabled={Object.keys(rowSelection).length === 0}
					onclick={() => {
						tableCtx.rowSelection = {};
					}}
				>
					<RotateCwIcon class="mr-2 size-4" />
					Clear selection
					<span class="ml-auto">({Object.keys(rowSelection).length})</span>
				</DropdownMenu.Item>
				<DropdownMenu.Item variant="destructive" disabled={Object.keys(rowSelection).length === 0}>
					<Trash2Icon class="mr-2 size-4" />
					Delete selected
					<span class="ml-auto">({Object.keys(rowSelection).length})</span>
				</DropdownMenu.Item>

				{#if exportable}
					<DropdownMenu.Separator />
					<DropdownMenu.Sub>
						<DropdownMenu.SubTrigger>
							<DownloadIcon class="mr-2 size-4" />
							Export
						</DropdownMenu.SubTrigger>
						<DropdownMenu.SubContent>
							<DropdownMenu.Label>Current Page</DropdownMenu.Label>
							<DropdownMenu.Item onclick={() => handleExportCurrentView('csv')}>
								<FileSpreadsheetIcon class="mr-2 size-4" />
								CSV
							</DropdownMenu.Item>
							<DropdownMenu.Item onclick={() => handleExportCurrentView('json')}>
								<FileBracesIcon class="mr-2 size-4" />
								JSON
							</DropdownMenu.Item>
							<DropdownMenu.Separator />
							<DropdownMenu.Label>All Data</DropdownMenu.Label>
							<DropdownMenu.Item disabled={exporting} onclick={() => handleExportAll('csv')}>
								<FileSpreadsheetIcon class="mr-2 size-4" />
								CSV
							</DropdownMenu.Item>
							<DropdownMenu.Item disabled={exporting} onclick={() => handleExportAll('json')}>
								<FileBracesIcon class="mr-2 size-4" />
								JSON
							</DropdownMenu.Item>
						</DropdownMenu.SubContent>
					</DropdownMenu.Sub>
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Root>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button variant="outline" size="sm" {...props}>
						<Columns2Icon />
						<span>Columns</span>
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
						{column.columnDef.header}
					</DropdownMenu.CheckboxItem>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
</div>

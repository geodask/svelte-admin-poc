<script lang="ts" generics="TData extends { id: string | number}">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { ChevronDownIcon, Columns2Icon, DownloadIcon, PlusIcon } from '@lucide/svelte';
	import type { Table } from '@tanstack/table-core';

	type Props = {
		searchColumn?: string;
		globalFilter?: string;
		tableFn: () => Table<TData>;
	};

	let { searchColumn, globalFilter, tableFn }: Props = $props();

	const table = $derived(tableFn());
</script>

<div class="flex items-center justify-between">
	<div class="flex grow items-center gap-2">
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

	<div>
		<Button size="sm" variant="outline">
			<DownloadIcon />
			Export
		</Button>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button variant="outline" size="sm" {...props}>
						<Columns2Icon />
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
						{column.columnDef.header}
					</DropdownMenu.CheckboxItem>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
</div>

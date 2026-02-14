<script lang="ts" generics="TData extends { id: string | number }">
	import { FlexRender } from '$lib/components/ui/data-table/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { getTableContext } from './resource-table-provider.svelte';

	const tableCtx = getTableContext();
	const table = $derived(tableCtx.table);
</script>

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
					<Table.Cell colspan={table.getAllColumns().length} class="h-24 text-center">
						No results.
					</Table.Cell>
				</Table.Row>
			{/if}
		</Table.Body>
	</Table.Root>
</div>

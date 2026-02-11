<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import ChevronLeftIcon from '@tabler/icons-svelte/icons/chevron-left';
	import ChevronRightIcon from '@tabler/icons-svelte/icons/chevron-right';
	import ChevronsLeftIcon from '@tabler/icons-svelte/icons/chevrons-left';
	import ChevronsRightIcon from '@tabler/icons-svelte/icons/chevrons-right';

	const { table } = $props();
</script>

<div class="flex items-center justify-between">
	<div class="hidden flex-1 text-sm text-muted-foreground lg:flex">
		{table.getRowCount()} row(s) total
	</div>
	<div class="flex w-full items-center gap-8 lg:w-fit">
		<div class="hidden items-center gap-2 lg:flex">
			<Label for="rows-per-page" class="text-sm font-medium">Rows per page</Label>
			<Select.Root
				type="single"
				value={`${table.getState().pagination.pageSize}`}
				onValueChange={(v) => {
					table.setPageSize(Number(v));
					table.resetPageIndex();
				}}
			>
				<Select.Trigger size="sm" class="w-20" id="rows-per-page">
					{table.getState().pagination.pageSize}
				</Select.Trigger>
				<Select.Content preventScroll={false} side="top">
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

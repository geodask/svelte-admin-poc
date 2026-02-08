<script lang="ts" generics="TData extends { id: string | number}">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Ellipsis, EyeIcon, SquarePenIcon, Trash2Icon } from '@lucide/svelte';
	import type { ResourceLike } from './types';

	type Props = {
		resource: ResourceLike<TData>;
		row: TData;
	};

	const { resource, row }: Props = $props();

	const {
		metadata: { name }
	} = $derived(resource);
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button variant="ghost" size="icon" class="size-8" {...props}>
				<Ellipsis class="size-4" />
				<span class="sr-only">Actions</span>
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		<DropdownMenu.Item>
			{#snippet child({ props })}
				<a href="{name}/{row.id}" {...props}>
					<EyeIcon class="mr-2 size-4" />
					View
				</a>
			{/snippet}
		</DropdownMenu.Item>
		<DropdownMenu.Item onclick={() => alert('Edit ' + row.id)}>
			<SquarePenIcon class="mr-2 size-4" />
			Edit
		</DropdownMenu.Item>
		<DropdownMenu.Separator />
		<DropdownMenu.Item variant="destructive" onclick={() => alert('Delete ' + row.id)}>
			<Trash2Icon class="mr-2 size-4" />
			Delete
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>

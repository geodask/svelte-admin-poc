<script lang="ts" generics="TData extends { id: string | number}">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Ellipsis, EyeIcon, SquarePenIcon, Trash2Icon } from '@lucide/svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Spinner } from '$lib/components/ui/spinner';
	import { toast } from 'svelte-sonner';
	import { getResourceContext } from './resource-provider.svelte';

	type Props = {
		row: TData;
	};

	const { row }: Props = $props();

	const ctx = getResourceContext();
	const resource = $derived(ctx.resource);

	let deleteDialogOpen = $state(false);
	let deleteLoading = $state(false);

	async function onDelete() {
		deleteLoading = true;
		const result = resource.remotes.deleteOne(row.id);
		const queriesToUpdate = [ctx.queries.getMany, ctx.queries.getOne].filter((q) => q != null);
		await result.updates(...queriesToUpdate);
		deleteLoading = false;
		deleteDialogOpen = false;
		toast.success('Deleted successfully');
	}
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
				<a href="{resource.metadata.name}/{row.id}" {...props}>
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
		<DropdownMenu.Item variant="destructive" onclick={() => (deleteDialogOpen = true)}>
			<Trash2Icon class="mr-2 size-4" />
			Delete
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>

<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. This will permanently delete your account and remove your data
				from our servers.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				disabled={deleteLoading}
				onclick={() => onDelete()}
				class={buttonVariants({ variant: 'destructive' })}
			>
				{#if deleteLoading}
					<Spinner />
				{:else}
					<Trash2Icon />
				{/if}
				Delete
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

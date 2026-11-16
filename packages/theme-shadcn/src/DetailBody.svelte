<!--
	The detail View's content: the record's heading with Edit and Delete, and its Fields. It
	awaits the record, so the detail View renders it inside its boundary.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { DetailViewState } from '@svelte-admin/core/views';
	import DeleteDialog from './DeleteDialog.svelte';
	import FieldValue from './FieldValue.svelte';

	let { view }: { view: DetailViewState } = $props();

	const record = $derived(await view.query);
	const title = $derived(view.title(record));

	// False on the server and until hydration: deleting needs JavaScript, so a page without it
	// never shows a Delete button that does nothing.
	let interactive = $state(false);
	let confirmingDelete = $state(false);
	onMount(() => {
		interactive = true;
	});
</script>

<svelte:head>
	<title>{title} · {view.resource.label}</title>
</svelte:head>

<div class="flex items-center justify-between gap-4">
	<h1 class="text-2xl font-semibold tracking-tight">{title}</h1>
	<div class="flex items-center gap-2">
		<a
			href={view.editHref}
			class="inline-flex h-9 items-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-muted"
		>
			Edit
		</a>
		{#if interactive}
			<button
				type="button"
				onclick={() => (confirmingDelete = true)}
				class="inline-flex h-9 items-center rounded-md border border-destructive/50 bg-background px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
			>
				Delete
			</button>
			<DeleteDialog bind:open={confirmingDelete} {title} confirm={view.delete} />
		{/if}
	</div>
</div>

<dl class="mt-5 grid gap-x-8 gap-y-4 rounded-lg border p-6 text-sm sm:grid-cols-[max-content_1fr]">
	{#each view.fields as field (field.key)}
		<div class="contents">
			<dt class="font-medium">
				{field.label}
				{#if field.description}
					<p class="text-xs font-normal text-muted-foreground">{field.description}</p>
				{/if}
			</dt>
			<dd><FieldValue {field} value={record[field.key]} /></dd>
		</div>
	{/each}
</dl>

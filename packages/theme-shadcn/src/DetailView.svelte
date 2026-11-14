<!--
	The detail View: one record of a Resource, each Field that isn't hidden as a label and a
	value shown by its Kind, in schema order, under a heading that names the record. It takes the
	Resource, its remote functions and the record's typed id as props, so a route passes them
	from admin.ts. It is built on the core's headless `createDetailView`.
-->
<script lang="ts">
	import type { Resource, ResourceRemote } from '@svelte-admin/core';
	import { createDetailView } from '@svelte-admin/core/views';
	import FieldValue from './FieldValue.svelte';

	let {
		resource,
		remote,
		id
	}: { resource: Resource; remote: ResourceRemote; id: string | number } = $props();

	// Derived, so the detail View follows the route to another record or Resource.
	const view = $derived(createDetailView(resource, remote, id));
	const record = $derived(await view.query);
	const title = $derived(view.title(record));
</script>

<svelte:head>
	<title>{title} · {resource.label}</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<div class="flex flex-col gap-1">
		<a href={view.listHref} class="w-fit text-sm text-muted-foreground hover:text-foreground">
			<span aria-hidden="true">←</span>
			{resource.label}
		</a>
		<h1 class="text-2xl font-semibold tracking-tight">{title}</h1>
	</div>

	<dl class="grid gap-x-8 gap-y-4 rounded-lg border p-6 text-sm sm:grid-cols-[max-content_1fr]">
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
</div>

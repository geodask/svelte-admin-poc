<!--
	The edit View: the create View's form, prefilled with the record's current values, under a
	heading that names the record by its Record title. It takes the Resource, its remote
	functions and the record's typed id as props, so a route passes them from admin.ts. It is
	built on the core's headless `createFormView`.

	It works without JavaScript, like the create View, and the prefill is rendered by the server
	too. A failed save keeps what the user typed. Save replaces every editable Field: an optional
	Field left empty is cleared.

	The record loads inside a boundary with a `failed` snippet but no `pending` one, so the server
	renders the form, or "not found" with a link back to the list for a record that doesn't
	exist, or Retry for any other failure.
-->
<script lang="ts">
	import type { Resource, ResourceRemote } from '@svelte-admin/core';
	import { createFormView } from '@svelte-admin/core/views';
	import EditBody from './EditBody.svelte';
	import LoadError from './LoadError.svelte';

	let {
		resource,
		remote,
		id
	}: { resource: Resource; remote: ResourceRemote; id: string | number } = $props();

	// Derived, so the View follows the route to another record or Resource.
	const view = $derived(createFormView(resource, remote, 'edit', id));
</script>

<div class="flex max-w-2xl flex-col gap-5">
	<svelte:boundary>
		<!-- Keyed, so another record's form is prefilled afresh. -->
		{#key view}
			<EditBody {view} />
		{/key}

		{#snippet failed(error, reset)}
			<LoadError
				{error}
				{resource}
				retry={() => view.refresh().then(reset, reset)}
				listViewHref={view.listViewHref}
				target="record"
			/>
		{/snippet}
	</svelte:boundary>
</div>

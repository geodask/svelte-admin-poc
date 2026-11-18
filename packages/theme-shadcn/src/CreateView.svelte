<!--
	The create View: a form with one labelled input per Field the form maps, in schema order, and
	Save and Cancel. It takes the admin, the Resource and its remote functions as props, so a
	route passes them from admin.ts. It is built on the core's headless `createFormView`.

	It works without JavaScript: the form posts to the page, and the server renders it again with
	the issues and what was typed, or redirects to the new record. With JavaScript the input is
	checked before it is sent, and issues follow typing once the form has been submitted. Save
	shows progress and is disabled while a save is in flight.

	The form sits in a boundary with a `failed` snippet but no `pending` one, so the server always
	renders it.
-->
<script lang="ts">
	import type { Admin, Resource, ResourceRemote } from '@svelte-admin/core';
	import { createFormView } from '@svelte-admin/core/views';
	import FormBody from './FormBody.svelte';

	let {
		admin,
		resource,
		remote
	}: {
		/** The admin from admin.ts. */
		admin: Admin;
		resource: Resource;
		remote: ResourceRemote;
	} = $props();

	// Derived, so the View follows the route to another Resource.
	const view = $derived(createFormView(admin, resource, remote, 'create'));
</script>

<svelte:head>
	<title>New · {resource.label}</title>
</svelte:head>

<div class="flex max-w-2xl flex-col gap-5">
	<h1 class="text-2xl font-semibold tracking-tight">New record in {resource.label}</h1>

	<svelte:boundary>
		<FormBody {view} />

		{#snippet failed(error, reset)}
			<div role="alert" class="flex flex-col items-start gap-3 rounded-lg border p-6 text-sm">
				<h2 class="text-lg font-semibold">Something went wrong</h2>
				<p class="text-muted-foreground">
					{(error as { message?: string } | undefined)?.message ?? 'The form could not be shown.'}
				</p>
				<button
					type="button"
					onclick={reset}
					class="inline-flex h-8 items-center rounded-md bg-primary px-3 font-medium text-primary-foreground hover:bg-primary/90"
				>
					Try again
				</button>
			</div>
		{/snippet}
	</svelte:boundary>
</div>

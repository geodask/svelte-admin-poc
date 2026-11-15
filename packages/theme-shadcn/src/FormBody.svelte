<!--
	The form of a create or edit View: one labelled input per Field the form maps, in schema
	order, and Save and Cancel. On edit it also carries the record's id as a hidden input. It is
	driven by the core's headless `createFormView`, so the create and edit Views share it.

	It works without JavaScript: the form posts to the page, and the server renders it again with
	the issues and what was typed, or redirects to the record's detail View. With JavaScript the
	input is checked before it is sent, and issues follow typing once the form has been
	submitted. Save shows progress and is disabled while a save is in flight.
-->
<script lang="ts">
	import type { FormViewState } from '@svelte-admin/core/views';
	import FieldInput from './FieldInput.svelte';

	let { view }: { view: FormViewState } = $props();

	const form = $derived(view.form);
</script>

<form
	{...form}
	novalidate
	oninput={() => view.revalidate()}
	class="flex flex-col gap-5 rounded-lg border p-6"
>
	{#if view.id !== undefined}
		<input {...form.fields.id.as('hidden', view.id)} />
	{/if}

	{#each view.spec as spec (spec.key)}
		<FieldInput {spec} field={form.fields[spec.key]} />
	{/each}

	<div class="flex items-center gap-2">
		<button
			type="submit"
			disabled={view.saving}
			class="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
		>
			{view.saving ? 'Saving…' : 'Save'}
		</button>
		<a
			href={view.cancelHref}
			class="inline-flex h-9 items-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-muted"
		>
			Cancel
		</a>
	</div>
</form>

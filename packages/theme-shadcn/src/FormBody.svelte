<!--
	The form of a create or edit View: one labelled input per Field the form maps, in schema
	order, and Save and Cancel. On edit it also carries the record's id as a hidden input, and
	shows the Fields the backend owns as text, in their place among the inputs, as the detail
	View shows them; they are never submitted. It is driven by the core's headless
	`createFormView`, so the create and edit Views share it.

	It works without JavaScript: the form posts to the page, and the server renders it again with
	the issues and what was typed, or redirects to the record's detail View. With JavaScript the
	input is checked before it is sent, and issues follow typing once the form has been
	submitted. Save shows progress and is disabled while a save is in flight.

	When the Provider refuses a save for a reason no input is to blame for (a conflict, or a
	record deleted meanwhile), the reason shows above the Fields, and what was typed stays.
-->
<script lang="ts">
	import type { FormViewState } from '@svelte-admin/core/views';
	import FieldInput from './FieldInput.svelte';
	import FieldValue from './FieldValue.svelte';
	import FormActions from './FormActions.svelte';

	let {
		view,
		record
	}: {
		view: FormViewState;
		/** The record being edited, whose read-only Fields show as text. Only on edit. */
		record?: Record<string, unknown>;
	} = $props();

	const form = $derived(view.form);
	const inputs = $derived(view.inputs);
</script>

<form
	{...form}
	novalidate
	oninput={() => view.revalidate()}
	class="flex flex-col gap-5 rounded-lg border p-6"
>
	{#if view.formIssues.length}
		<div
			role="alert"
			class="rounded-md border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive"
		>
			{#each view.formIssues as issue, index (index)}
				<p>{issue.message}</p>
			{/each}
		</div>
	{/if}

	{#if view.id !== undefined}
		<input {...inputs.id.as('hidden', view.id)} />
	{/if}

	{#each view.spec as spec (spec.key)}
		{#if spec.kind === 'readOnly'}
			<dl class="flex flex-col gap-1.5 text-sm">
				<dt class="font-medium">
					{spec.label}
					{#if spec.description}
						<p class="text-xs font-normal text-muted-foreground">{spec.description}</p>
					{/if}
				</dt>
				<dd><FieldValue field={spec.field} value={record?.[spec.key]} /></dd>
			</dl>
		{:else}
			<FieldInput {spec} field={inputs[spec.key]} />
		{/if}
	{/each}

	<FormActions saving={view.saving} cancelHref={view.cancelHref} />
</form>

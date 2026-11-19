<!--
	The `stars` Kind's input on the create and edit Views: a radio group with one choice per star,
	from 1 to 5, and "None", so a rating can't be out of range, with or without JavaScript. Each
	radio sends its rating as text under the Field's name ("None" sends nothing), which the form
	reads as a number. It renders the Field's label, help text and issues itself, with the Theme's
	FieldIssues.
-->
<script lang="ts">
	import type { KindInputProps, RemoteFormField } from '@svelte-admin/core';
	import { FieldIssues } from '@svelte-admin/theme-shadcn';

	let { spec, field: given }: KindInputProps = $props();

	// Every input of a remote form is one at runtime, typed or not.
	const field = $derived(given as RemoteFormField);

	const RATINGS = ['1', '2', '3', '4', '5'];

	const id = $props.id();
	const helpId = `${id}-help`;
	const issuesId = `${id}-issues`;
	const issues = $derived(field.issues());
	const describedBy = $derived(
		[spec.description && helpId, issues?.length && issuesId].filter(Boolean).join(' ') || undefined
	);
	/**
	 * The rating the group shows as chosen, as text: the record's number when the edit form is
	 * prefilled, the radio's text once one is chosen.
	 */
	const current = $derived(String(field.value() ?? ''));
	/** The name every radio submits under, as the remote form names the Field's inputs. */
	const name = $derived(String(field.as('radio', '1').name));
</script>

<fieldset class="flex flex-col gap-1.5" aria-describedby={describedBy}>
	<legend class="text-sm font-medium">
		{spec.label}
		{#if spec.required}<span aria-hidden="true" class="text-destructive">*</span>{/if}
	</legend>
	<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
		{#each RATINGS as rating (rating)}
			<label class="flex items-center gap-1.5 text-sm">
				<!-- `checked` after the spread: the prefilled rating is a number, a radio's value text. -->
				<input {...field.as('radio', rating)} checked={current === rating} class="accent-primary" />
				<span aria-hidden="true" class="text-amber-500">{'★'.repeat(Number(rating))}</span>
				<span class="sr-only">{rating === '1' ? '1 star' : `${rating} stars`}</span>
			</label>
		{/each}
		{#if !spec.required}
			<label class="flex items-center gap-1.5 text-sm">
				<input type="radio" {name} value="" checked={current === ''} class="accent-primary" />
				None
			</label>
		{/if}
	</div>
	{#if spec.description}
		<p id={helpId} class="text-xs text-muted-foreground">{spec.description}</p>
	{/if}
	<FieldIssues id={issuesId} {issues} />
</fieldset>

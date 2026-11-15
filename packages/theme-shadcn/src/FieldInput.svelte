<!--
	One Field's input on a create or edit form, chosen by its spec kind: a text, email or url
	input, a number, a checkbox, a select, a date, or a datetime read and written in UTC. It shows
	the Field's label (with a marker when it is required), its description as help text, and its
	issues under it. The form sets `novalidate`, so the browser never blocks a submit: every rule
	comes from the Resource's schema, with and without JavaScript.
-->
<script lang="ts">
	import type { FormFieldSpec, RemoteFormField } from '@svelte-admin/core';
	import FieldIssues from './FieldIssues.svelte';

	let { spec, field }: { spec: FormFieldSpec; field: RemoteFormField } = $props();

	const inputId = $props.id();
	const issuesId = `${inputId}-issues`;
	const helpId = `${inputId}-help`;
	const issues = $derived(field.issues());
	const describedBy = $derived(
		[spec.description && helpId, issues?.length && issuesId].filter(Boolean).join(' ') || undefined
	);

	const control =
		'h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive';
</script>

{#snippet label()}
	<span class="text-sm font-medium">
		{spec.label}
		{#if spec.kind === 'datetime'}<span class="font-normal text-muted-foreground">(UTC)</span>{/if}
		{#if spec.required && spec.kind !== 'checkbox'}
			<span aria-hidden="true" class="text-destructive">*</span>
		{/if}
	</span>
{/snippet}

<div class="flex flex-col gap-1.5">
	{#if spec.kind === 'checkbox'}
		<label class="flex items-center gap-2">
			<input
				{...field.as('checkbox')}
				id={inputId}
				aria-describedby={describedBy}
				class="size-4 accent-primary"
			/>
			{@render label()}
		</label>
	{:else}
		<label for={inputId}>{@render label()}</label>
		{#if spec.kind === 'select'}
			<select
				{...field.as('select')}
				id={inputId}
				aria-required={spec.required}
				aria-describedby={describedBy}
				class={control}
			>
				<option value="">{spec.required ? 'Choose…' : '—'}</option>
				{#each spec.options as option (option)}
					<option value={String(option)}>{option}</option>
				{/each}
			</select>
		{:else}
			<input
				{...field.as(
					spec.kind === 'text'
						? spec.format
						: spec.kind === 'datetime'
							? 'datetime-local'
							: spec.kind
				)}
				id={inputId}
				step={spec.kind === 'number' ? (spec.integer ? 1 : 'any') : undefined}
				aria-required={spec.required}
				aria-describedby={describedBy}
				class={control}
			/>
		{/if}
	{/if}
	{#if spec.description}
		<p id={helpId} class="text-xs text-muted-foreground">{spec.description}</p>
	{/if}
	<FieldIssues id={issuesId} {issues} />
</div>

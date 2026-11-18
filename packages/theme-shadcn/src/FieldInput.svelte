<!--
	One Field's input on a create or edit form, chosen by its spec kind: a text, email or url
	input, a textarea, a number, a checkbox, a select, a date, a datetime read and written in UTC,
	a list, rows or a group, or for a Reference the ReferencePicker when given the admin (without
	it, an input for the id itself, of the id's type). It shows the Field's label (with a marker when it is required), its
	placeholder in the input, its description as help text, and its issues under it. The form
	sets `novalidate`, so the browser never blocks a submit: every rule comes from the Resource's
	schema, with and without JavaScript.

	A list in rows and rows always end with one blank row: typing into it adds an item (without
	JavaScript, one item per save), and clearing a row removes its item. With JavaScript a ×
	button removes a row in place; it renders only after hydration, so a page without JavaScript
	never shows a dead button. A list in lines is one textarea with one item per line. A group is
	a fieldset of its Fields' inputs. A list, rows or a group renders its items' and Fields'
	inputs with this same component, and shows its own issues (a rule about the whole Field)
	at its foot, while an item's issues show under that item's input.

	A Theme part, exported for a replaced create or edit View: give it one Field's spec from the
	core's `createFormView` and that Field's input from the view's form.
-->
<script module lang="ts">
	import type { Admin, FormInputSpec, RemoteFormFieldLike } from '@svelte-admin/core';

	export type FieldInputProps = {
		/** The Field's input spec, one of the core's `createFormView(...).spec`. */
		spec: FormInputSpec;
		/**
		 * The Field's input on the remote form: typed (`view.form.fields.status`) or untyped
		 * (`view.inputs.status`).
		 */
		field: RemoteFormFieldLike;
		/**
		 * Keep the label for assistive technology only, e.g. for each item of a list. Only for a
		 * Field that is one input, not a checkbox.
		 */
		labelHidden?: boolean;
		/**
		 * The admin from admin.ts (`view.admin`), so a Reference gets its picker. Without it, a
		 * Reference is an input for the id itself.
		 */
		admin?: Admin;
	};
</script>

<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import {
		rowCount,
		withoutRow,
		type RemoteFormField,
		type RemoteFormInputType
	} from '@svelte-admin/core';
	import FieldInput from './FieldInput.svelte';
	import FieldIssues from './FieldIssues.svelte';
	import ReferencePicker from './ReferencePicker.svelte';

	let { spec, field: given, labelHidden = false, admin }: FieldInputProps = $props();

	// Every input of a remote form is one at runtime, typed or not: read its items, its Fields
	// and its attributes untyped, as for any Field.
	const field = $derived(given as RemoteFormField);

	type ListSpec = Extract<FormInputSpec, { kind: 'list' }>;
	type RowsSpec = Extract<FormInputSpec, { kind: 'rows' }>;
	type GroupSpec = Extract<FormInputSpec, { kind: 'group' }>;

	const inputId = $props.id();
	const issuesId = `${inputId}-issues`;
	const helpId = `${inputId}-help`;
	const issues = $derived(field.issues());
	/** The help under the input: the Field's description, and how a list in lines is written. */
	const help = $derived(
		[spec.description, spec.kind === 'list' && spec.mode === 'lines' ? 'One per line.' : '']
			.filter(Boolean)
			.join(' ')
	);
	const describedBy = $derived(
		[help && helpId, issues?.length && issuesId].filter(Boolean).join(' ') || undefined
	);
	const rows = $derived(
		spec.kind === 'rows' || (spec.kind === 'list' && spec.mode === 'rows')
			? rowCount(field.value())
			: 0
	);
	/** The index of each row a list in rows, or rows, shows: its items, then the blank row. */
	const rowIndexes = $derived(Array.from({ length: rows }, (_, row) => row));

	// False on the server and until hydration, so × renders only once it can work.
	let interactive = $state(false);
	onMount(() => {
		interactive = true;
	});

	function remove(row: number) {
		field.set(withoutRow(field.value(), row));
	}

	/** The type and `step` of the one `<input>` a scalar spec renders. */
	const scalarInput = $derived.by((): { type: RemoteFormInputType; step?: number | 'any' } => {
		switch (spec.kind) {
			case 'text':
				return { type: spec.format };
			case 'datetime':
				return { type: 'datetime-local' };
			case 'number':
				return { type: 'number', step: spec.integer ? 1 : 'any' };
			case 'reference':
				// Without the admin, a Reference is an input for the id itself, of the id's type.
				return spec.id === 'number' ? { type: 'number', step: 1 } : { type: 'text' };
			case 'date':
				return { type: 'date' };
			default:
				return { type: 'text' };
		}
	});

	const control =
		'w-full min-w-0 rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive';
</script>

{#snippet labelText()}
	<span class="text-sm font-medium">
		{spec.label}
		{#if spec.kind === 'datetime'}<span class="font-normal text-muted-foreground">(UTC)</span>{/if}
		{#if spec.required && spec.kind !== 'checkbox'}
			<span aria-hidden="true" class="text-destructive">*</span>
		{/if}
	</span>
{/snippet}

{#snippet foot()}
	{#if help}
		<p id={helpId} class="text-xs text-muted-foreground">{help}</p>
	{/if}
	<FieldIssues id={issuesId} {issues} />
{/snippet}

{#snippet removeButton(row: number)}
	{#if interactive && row < rows - 1}
		<button
			type="button"
			aria-label="Remove {spec.label} {row + 1}"
			onclick={() => remove(row)}
			class="inline-flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-base hover:bg-muted"
		>
			×
		</button>
	{:else if interactive}
		<!-- The blank row has nothing to remove, but keeps the rows lined up. -->
		<span aria-hidden="true" class="size-9 shrink-0"></span>
	{/if}
{/snippet}

<!-- A list's, rows' or group's fieldset: its label, its inputs, then its help and own issues. -->
{#snippet container(inputs: Snippet)}
	<fieldset
		class="flex min-w-0 flex-col gap-3 rounded-md border p-4"
		aria-describedby={describedBy}
	>
		<legend class="px-1">{@render labelText()}</legend>
		{@render inputs()}
		{@render foot()}
	</fieldset>
{/snippet}

<!-- One row of a list in rows, or of rows, then its × button. -->
{#snippet eachRow(rowInputs: Snippet<[number]>)}
	{#each rowIndexes as row (row)}
		<div class="flex items-start gap-2">
			{@render rowInputs(row)}
			{@render removeButton(row)}
		</div>
	{/each}
{/snippet}

{#snippet listItem(row: number)}
	<div class="min-w-0 flex-1">
		<FieldInput
			spec={{ ...(spec as ListSpec).item, label: `${spec.label} ${row + 1}`, required: false }}
			field={field[row]}
			labelHidden
		/>
	</div>
{/snippet}

{#snippet objectRow(row: number)}
	<fieldset class="flex min-w-0 flex-1 flex-col gap-3 rounded-md bg-muted/40 p-3">
		<legend class="text-xs text-muted-foreground">{spec.label} {row + 1}</legend>
		{#each (spec as RowsSpec).fields as child (child.key)}
			<FieldInput spec={child} field={field[row][child.key]} />
		{/each}
	</fieldset>
{/snippet}

{#snippet listRows()}
	{@render eachRow(listItem)}
{/snippet}

{#snippet objectRows()}
	{@render eachRow(objectRow)}
{/snippet}

{#snippet groupFields()}
	{#each (spec as GroupSpec).fields as child (child.key)}
		<FieldInput spec={child} field={field[child.key]} />
	{/each}
{/snippet}

{#if spec.kind === 'reference' && admin}
	<ReferencePicker {admin} {spec} {field} {labelHidden} />
{:else if spec.kind === 'list' && spec.mode === 'rows'}
	{@render container(listRows)}
{:else if spec.kind === 'rows'}
	{@render container(objectRows)}
{:else if spec.kind === 'group'}
	{@render container(groupFields)}
{:else}
	<div class="flex flex-col gap-1.5">
		{#if spec.kind === 'checkbox'}
			<label class="flex items-center gap-2">
				<input
					{...field.as('checkbox')}
					id={inputId}
					aria-describedby={describedBy}
					class="size-4 accent-primary"
				/>
				{@render labelText()}
			</label>
		{:else}
			<label for={inputId} class={labelHidden ? 'sr-only' : undefined}>{@render labelText()}</label>
			{#if spec.kind === 'select'}
				<select
					{...field.as('select')}
					id={inputId}
					aria-required={spec.required}
					aria-describedby={describedBy}
					class={[control, 'h-9']}
				>
					<option value="">{spec.required ? 'Choose…' : '—'}</option>
					{#each spec.options as option (option)}
						<option value={String(option)}>{option}</option>
					{/each}
				</select>
			{:else if spec.kind === 'textarea' || spec.kind === 'list'}
				<!--
					A list here is in lines: one textarea, one item per line. The value is set apart
					from the spread too, so the server renders it as the textarea's content.
				-->
				{@const attributes = field.as('text')}
				<textarea
					{...attributes}
					value={attributes.value as string}
					id={inputId}
					placeholder={spec.placeholder}
					rows={spec.kind === 'list' ? 4 : 5}
					aria-required={spec.required}
					aria-describedby={describedBy}
					class={[control, 'py-2']}></textarea>
			{:else}
				<input
					{...field.as(scalarInput.type)}
					id={inputId}
					placeholder={spec.placeholder}
					step={scalarInput.step}
					aria-required={spec.required}
					aria-describedby={describedBy}
					class={[control, 'h-9']}
				/>
			{/if}
		{/if}
		{@render foot()}
	</div>
{/if}

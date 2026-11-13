<!-- PROTOTYPE (PER-17): renders one Field from its FormFieldSpec. Recursive for rows and groups. -->
<script lang="ts">
	import FieldInput from './FieldInput.svelte';
	import type { FormFieldSpec } from './form-spec';

	const isBlank = (v: unknown): boolean =>
		v === undefined || v === null || v === '' ||
		(typeof v === 'object' && Object.values(v as object).every(isBlank));

	let {
		spec,
		field,
		record
	}: {
		spec: FormFieldSpec;
		/** the remote form's field proxy for this Field (e.g. `form.fields.ingredients[2].name`) */
		field: any;
		/** edit only: the stored value, for read-only Fields */
		record?: unknown;
	} = $props();

	const issues = $derived(field.issues() as { message: string }[] | undefined);

	/** arrays always render one blank row at the end: type into it to add an item (works without JS) */
	function rowCount() {
		// trailing blank items (e.g. echoed back after a no-JS submit) don't count as rows
		const v = field.value();
		const items: unknown[] = Array.isArray(v) ? v : [];
		let n = items.length;
		while (n > 0 && isBlank(items[n - 1])) n--;
		return n + 1;
	}

	function removeRow(i: number) {
		const v = field.value();
		if (Array.isArray(v)) field.set(v.filter((_: unknown, j: number) => j !== i));
	}
</script>

{#snippet issueList(list: { message: string }[] | undefined)}
	{#if list}
		{#each list as issue (issue.message)}
			<p class="issue">{issue.message}</p>
		{/each}
	{/if}
{/snippet}

{#snippet labelText()}
	<span class="label">{spec.label}{#if spec.required && spec.kind !== 'checkbox'}<span class="req" title="required"> *</span>{/if}</span>
{/snippet}

{#if spec.readOnly}
	<div class="field readonly">
		<span class="label">{spec.label} <span class="tag">read-only</span></span>
		<output>{record instanceof Date ? record.toLocaleString() : (record ?? '—')}</output>
	</div>
{:else if spec.kind === 'text'}
	<label class="field">
		{@render labelText()}
		<input {...field.as(spec.format)} placeholder={spec.placeholder} />
		{#if spec.description}<small>{spec.description}</small>{/if}
		{@render issueList(issues)}
	</label>
{:else if spec.kind === 'textarea'}
	<label class="field">
		{@render labelText()}
		<textarea {...field.as('text')} rows="3" placeholder={spec.placeholder}></textarea>
		{#if spec.description}<small>{spec.description}</small>{/if}
		{@render issueList(issues)}
	</label>
{:else if spec.kind === 'number'}
	<label class="field">
		{@render labelText()}
		<input {...field.as('number')} step={spec.integer ? 1 : 'any'} placeholder={spec.placeholder} />
		{@render issueList(issues)}
	</label>
{:else if spec.kind === 'date'}
	<label class="field">
		{@render labelText()}
		<input {...field.as('date')} />
		{@render issueList(issues)}
	</label>
{:else if spec.kind === 'checkbox'}
	<label class="field inline">
		<input {...field.as('checkbox')} />
		{@render labelText()}
		{@render issueList(issues)}
	</label>
{:else if spec.kind === 'select'}
	<label class="field">
		{@render labelText()}
		<select {...field.as('select')}>
			<option value="">{spec.required ? 'Choose…' : '—'}</option>
			{#each spec.options as option (option)}
				<option value={option}>{option}</option>
			{/each}
		</select>
		{@render issueList(issues)}
	</label>
{:else if spec.kind === 'list' && spec.mode === 'lines'}
	<label class="field">
		{@render labelText()}
		<textarea {...field.as('text')} rows="3"></textarea>
		<small>One per line.</small>
		{@render issueList(field.allIssues())}
	</label>
{:else if spec.kind === 'list'}
	<fieldset class="field list">
		<legend>{spec.label}</legend>
		{#each { length: rowCount() } as _, i (i)}
			<div class="row">
				<FieldInput spec={{ ...spec.item, label: `${spec.label} ${i + 1}`, required: false }} field={field[i]} />
				{#if i < rowCount() - 1}
					<button type="button" class="remove" title="Remove" onclick={() => removeRow(i)}>×</button>
				{/if}
			</div>
		{/each}
		<small>Type in the last empty row to add one. Clear a row to remove it.</small>
		{@render issueList(issues)}
	</fieldset>
{:else if spec.kind === 'rows'}
	<fieldset class="field rows">
		<legend>{spec.label}{#if spec.required}<span class="req"> *</span>{/if}</legend>
		{#each { length: rowCount() } as _, i (i)}
			<div class="row" class:blank={i === rowCount() - 1}>
				{#each spec.fields as child (child.key)}
					<FieldInput spec={child} field={field[i][child.key]} />
				{/each}
				{#if i < rowCount() - 1}
					<button type="button" class="remove" title="Remove" onclick={() => removeRow(i)}>×</button>
				{/if}
			</div>
		{/each}
		<small>The last row is blank: fill it to add an item. A cleared row is dropped.</small>
		{@render issueList(issues)}
	</fieldset>
{:else if spec.kind === 'group'}
	<fieldset class="field group">
		<legend>{spec.label}{#if !spec.required}<span class="opt"> (optional: leave all blank for none)</span>{/if}</legend>
		{#each spec.fields as child (child.key)}
			<FieldInput spec={child} field={field[child.key]} />
		{/each}
		{@render issueList(issues)}
	</fieldset>
{:else}
	<div class="field unsupported">
		{spec.label}: no generated input for <code>{spec.zodType}</code>. An app would supply one.
	</div>
{/if}

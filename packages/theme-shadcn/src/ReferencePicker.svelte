<!--
	A Reference's input on a create or edit form: a choice of the target's records by their Record
	title, built on the core's headless `createReferencePicker`. Both forms of it submit the chosen
	record's id under the Field's name, and show the Field's label (with a marker when it is
	required), its description as help text and its issues under it, as any input does.

	The server renders a plain `<select>`, so it works without JavaScript: the target's first 50
	records in its default order, plus the current one when it isn't among them, after a "—" choice
	(or "Choose…" for a required Reference) that leaves it empty. A current id that names no record
	shows as itself, marked "not found".

	Once hydrated it becomes a combobox, following the ARIA combobox pattern: a text input that
	shows the current choice's title, with a listbox of records under it. Typing searches the
	target after a 300 ms pause, like the list search (a searchable target is asked to search; any
	other target's first 50 records are filtered by title). Arrow keys move through the records,
	Enter chooses one and Escape closes the list. Emptying the text clears the choice, and leaving
	the input shows the current choice's title again.

	A Theme part, exported for a replaced create or edit View: give it the admin, one Reference
	input's spec from the core's `createFormView` and that Field's input from the view's form.
	FieldInput renders it for a Reference when given the admin.
-->
<script module lang="ts">
	import type { Admin, FormInputSpec, RemoteFormFieldLike } from '@svelte-admin/core';

	export type ReferencePickerProps = {
		/** The admin from admin.ts (`view.admin`), through which the target is reached. */
		admin: Admin;
		/** A Reference input's spec, one of the core's `createFormView(...).spec`. */
		spec: FormInputSpec;
		/**
		 * The Field's input on the remote form: typed (`view.form.fields.userId`) or untyped
		 * (`view.inputs.userId`).
		 */
		field: RemoteFormFieldLike;
		/** Keep the label for assistive technology only. */
		labelHidden?: boolean;
	};
</script>

<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import {
		createReferencePicker,
		type ReferenceOption,
		type RemoteFormField
	} from '@svelte-admin/core';
	import FieldIssues from './FieldIssues.svelte';

	let { admin, spec, field: given, labelHidden = false }: ReferencePickerProps = $props();

	/** How long typing must pause before the target is searched, as in the list search. */
	const SEARCH_DEBOUNCE_MS = 300;

	// Every input of a remote form is one at runtime, typed or not.
	const field = $derived(given as RemoteFormField);

	// The current choice is read once: afterwards the combobox keeps it, and a form posted without
	// JavaScript renders the page, and so this part, again.
	const current = untrack(() => field.value());
	const currentText =
		typeof current === 'string' || typeof current === 'number' ? String(current) : '';
	const picker = $derived(createReferencePicker(admin, spec, currentText));

	/** The `<select>`'s options, or none (but the current id) when the first page failed. */
	async function loadOptions(): Promise<{ options: ReferenceOption[]; failed: boolean }> {
		try {
			return { options: await picker.options, failed: false };
		} catch {
			const options: ReferenceOption[] =
				currentText === '' ? [] : [{ id: currentText, title: currentText }];
			return { options, failed: true };
		}
	}

	const loaded = $derived(await loadOptions());

	const inputId = $props.id();
	const issuesId = `${inputId}-issues`;
	const helpId = `${inputId}-help`;
	const listboxId = `${inputId}-listbox`;
	const issues = $derived(field.issues());
	const describedBy = $derived(
		[spec.description && helpId, issues?.length && issuesId].filter(Boolean).join(' ') || undefined
	);
	const targetLabel = $derived(picker.target.label);
	const loadFailed = $derived(`Couldn't load ${targetLabel.toLowerCase()}.`);

	// False on the server and until hydration: the `<select>` renders until then.
	let interactive = $state(false);

	// The combobox's state.
	/** The chosen record, whose id the form submits. */
	let chosen = $state<ReferenceOption | undefined>();
	/** The text in the combobox. */
	let text = $state('');
	let open = $state(false);
	/** The records the listbox offers. */
	let results = $state<ReferenceOption[]>([]);
	/** The index of the record the arrow keys are on, or -1 for none. */
	let active = $state(-1);
	let status = $state<'idle' | 'searching' | 'failed'>('idle');
	let hidden = $state<HTMLInputElement>();
	let debounce: ReturnType<typeof setTimeout> | undefined;
	/** Counts searches, so an answer that comes after a later search's is dropped. */
	let searches = 0;

	/** What the listbox says while it has no records to show, or about the search. */
	const statusText = $derived(
		!open
			? ''
			: status === 'searching'
				? 'Searching…'
				: status === 'failed'
					? loadFailed
					: results.length === 0
						? 'No matches.'
						: `${results.length} ${results.length === 1 ? 'match' : 'matches'}.`
	);

	const optionId = (index: number) => `${inputId}-option-${index}`;
	const titleOf = (option: ReferenceOption | undefined) => option?.title ?? '';

	onMount(() => {
		chosen =
			currentText === ''
				? undefined
				: loaded.options.find((option) => String(option.id) === currentText);
		text = titleOf(chosen);
		interactive = true;
		return () => clearTimeout(debounce);
	});

	/** Ask the picker for the records matching `query`, and show them once they come. */
	async function search(query: string) {
		clearTimeout(debounce);
		const ticket = ++searches;
		open = true;
		status = 'searching';
		try {
			const found = await picker.search(query);
			if (ticket !== searches) return;
			results = found;
			const at = found.findIndex((option) => String(option.id) === String(chosen?.id));
			active = at;
			status = 'idle';
		} catch {
			if (ticket !== searches) return;
			results = [];
			active = -1;
			status = 'failed';
		}
	}

	/** Open the listbox on every record, from the arrow keys or a click. */
	function openAll() {
		if (open) return;
		// The text still shows the choice: list every record, not those named like it.
		void search(text === titleOf(chosen) ? '' : text);
	}

	function close() {
		clearTimeout(debounce);
		searches++;
		open = false;
		active = -1;
		status = 'idle';
	}

	/** Choose a record (or none), and tell the form, so its issues follow. */
	async function choose(option: ReferenceOption | undefined) {
		chosen = option;
		text = titleOf(option);
		close();
		field.set(option === undefined ? '' : String(option.id));
		await tick();
		// The hidden input holds the id now: an input event lets the form read it and revalidate.
		hidden?.dispatchEvent(new Event('input', { bubbles: true }));
	}

	function oninput(event: Event & { currentTarget: HTMLInputElement }) {
		text = event.currentTarget.value;
		clearTimeout(debounce);
		if (text.trim() === '') {
			// Emptying the text clears the choice.
			if (chosen !== undefined) void choose(undefined);
			return;
		}
		open = true;
		status = 'searching';
		const query = text;
		debounce = setTimeout(() => void search(query), SEARCH_DEBOUNCE_MS);
	}

	function onkeydown(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				if (!open) openAll();
				else if (results.length > 0) active = Math.min(active + 1, results.length - 1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				if (open && results.length > 0) active = Math.max(active - 1, 0);
				break;
			case 'Enter':
				if (!open) break;
				// Choosing never submits the form.
				event.preventDefault();
				if (active >= 0 && active < results.length) void choose(results[active]);
				break;
			case 'Escape':
				if (!open) break;
				event.preventDefault();
				close();
				text = titleOf(chosen);
				break;
		}
	}

	function onblur() {
		close();
		text = titleOf(chosen);
	}

	const control =
		'w-full min-w-0 rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive';
</script>

<div class="flex flex-col gap-1.5">
	<label for={inputId} class={labelHidden ? 'sr-only' : undefined}>
		<span class="text-sm font-medium">
			{spec.label}
			{#if spec.required}<span aria-hidden="true" class="text-destructive">*</span>{/if}
		</span>
	</label>

	{#if interactive}
		<input
			{...field.as('hidden', chosen === undefined ? '' : String(chosen.id))}
			bind:this={hidden}
		/>
		<div class="relative">
			<input
				id={inputId}
				type="text"
				role="combobox"
				autocomplete="off"
				aria-autocomplete="list"
				aria-expanded={open}
				aria-controls={listboxId}
				aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
				aria-required={spec.required}
				aria-invalid={issues?.length ? 'true' : undefined}
				aria-describedby={describedBy}
				placeholder="Search {targetLabel.toLowerCase()}…"
				value={text}
				{oninput}
				{onkeydown}
				{onblur}
				onclick={openAll}
				class={[control, 'h-9', chosen?.missing && 'text-muted-foreground']}
			/>
			<div
				class={[
					'absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md',
					!open && 'hidden'
				]}
			>
				<ul id={listboxId} role="listbox" aria-label={spec.label}>
					{#each results as option, index (option.id)}
						<!-- The combobox's input takes the keys for its options, as the ARIA pattern says. -->
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<li
							id={optionId(index)}
							role="option"
							aria-selected={index === active}
							onmousedown={(event) => event.preventDefault()}
							onclick={() => void choose(option)}
							class={[
								'cursor-pointer rounded-sm px-2 py-1.5',
								index === active && 'bg-accent text-accent-foreground',
								String(option.id) === String(chosen?.id) && 'font-medium'
							]}
						>
							{option.title}
						</li>
					{/each}
				</ul>
				{#if results.length === 0 || status !== 'idle'}
					<p aria-hidden="true" class="px-2 py-1.5 text-muted-foreground">{statusText}</p>
				{/if}
			</div>
			<!-- Outside the list, which is hidden while closed, so screen readers hear it change. -->
			<p role="status" class="sr-only">{statusText}</p>
		</div>
	{:else}
		<select
			{...field.as('select')}
			id={inputId}
			aria-required={spec.required}
			aria-describedby={describedBy}
			class={[control, 'h-9']}
		>
			<option value="">{spec.required ? 'Choose…' : '—'}</option>
			{#each loaded.options as option (option.id)}
				<option value={String(option.id)}>
					{option.title}{option.missing ? ' (not found)' : ''}
				</option>
			{/each}
		</select>
		{#if loaded.failed}
			<p class="text-xs text-muted-foreground">{loadFailed}</p>
		{/if}
	{/if}

	{#if spec.description}
		<p id={helpId} class="text-xs text-muted-foreground">{spec.description}</p>
	{/if}
	<FieldIssues id={issuesId} {issues} />
</div>

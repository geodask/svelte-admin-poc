<!-- PROTOTYPE (PER-17): the generic create / edit View body. Takes the Resource as a prop (PER-13). -->
<script lang="ts">
	import { page } from '$app/state';
	import FieldInput from './FieldInput.svelte';
	import {
		formSchema,
		normalizeFormInput,
		toFormSpec,
		toFormValues,
		type View
	} from './form-spec';
	import type { Resource } from './resource';

	let {
		resource,
		view,
		form,
		record
	}: {
		resource: Resource;
		view: View;
		/** the remote form from serveResource: `create`, or `update.for(id)` */
		form: any;
		record?: Record<string, unknown>;
	} = $props();

	const listMode = $derived(page.url.searchParams.get('arrays') === 'lines' ? 'lines' : 'rows');
	const spec = $derived(toFormSpec(resource, view, { listMode }));

	// Prefill. Runs during SSR too, so the form works without JS. Kit ignores it after a failed
	// submission, so the user's input and the issues survive.
	// svelte-ignore state_referenced_locally
	form.fields.set(toFormValues(resource, toFormSpec(resource, view, { listMode }), record));

	// Same schema in the browser: instant per-Field issues before the round trip.
	// svelte-ignore state_referenced_locally
	const enhanced = form.preflight(formSchema(resource, view));

	const allIssues = $derived(form.fields.allIssues() as { path: unknown[]; message: string }[] | undefined);
</script>

<div class="layout">
	<form {...enhanced} novalidate>
		{#if view === 'edit' && record}
			<input {...form.fields[resource.idKey].as('hidden', record[resource.idKey])} />
		{/if}

		{#each spec as f (f.key)}
			<FieldInput spec={f} field={form.fields[f.key]} record={record?.[f.key]} />
		{/each}

		<div class="actions">
			<button type="submit" disabled={form.pending > 0}>
				{view === 'create' ? `Create` : 'Save changes'}
			</button>
			{#if form.pending}<span>Saving…</span>{/if}
		</div>
	</form>

	<aside class="state">
		<h3>Prototype state</h3>
		<details open>
			<summary>Form values (what the inputs hold)</summary>
			<pre>{JSON.stringify(form.fields.value(), null, 1)}</pre>
		</details>
		<details open>
			<summary>After normalising (what the Resource schema validates)</summary>
			<pre>{JSON.stringify(normalizeFormInput(resource, view, form.fields.value() ?? {}), null, 1)}</pre>
		</details>
		<details open>
			<summary>Issues ({allIssues?.length ?? 0})</summary>
			<pre>{JSON.stringify(allIssues?.map((i) => `${i.path.join('.')}: ${i.message}`) ?? [], null, 1)}</pre>
		</details>
		<details>
			<summary>Form spec (input chosen per Field)</summary>
			<pre>{JSON.stringify(spec, null, 1)}</pre>
		</details>
	</aside>
</div>

<!--
	The edit View's content: the heading that names the record, and the form, prefilled with the
	record's values. It awaits the record, so the edit View renders it inside its boundary.
-->
<script lang="ts">
	import type { FormViewState } from '@svelte-admin/core/views';
	import FormBody from './FormBody.svelte';

	let { view }: { view: FormViewState } = $props();

	const record = $derived(await view.query);
	const title = $derived(view.title(record));

	// Once, during render, so the server renders the values too. Kit skips it after a failed
	// submit, so what the user typed stays. Only the first record counts: the form must not
	// be refilled when the record's query changes after a save.
	// svelte-ignore state_referenced_locally
	view.prefill(record);
</script>

<svelte:head>
	<title>Edit {title} · {view.resource.label}</title>
</svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Edit {title}</h1>

<FormBody {view} />

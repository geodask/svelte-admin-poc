<!--
	The detail View's content: the record's heading and its Fields. It awaits the record, so the
	detail View renders it inside its boundary.
-->
<script lang="ts">
	import type { DetailViewState } from '@svelte-admin/core/views';
	import FieldValue from './FieldValue.svelte';

	let { view }: { view: DetailViewState } = $props();

	const record = $derived(await view.query);
	const title = $derived(view.title(record));
</script>

<svelte:head>
	<title>{title} · {view.resource.label}</title>
</svelte:head>

<div class="flex items-center justify-between gap-4">
	<h1 class="text-2xl font-semibold tracking-tight">{title}</h1>
	<a
		href={view.editHref}
		class="inline-flex h-9 items-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-muted"
	>
		Edit
	</a>
</div>

<dl class="mt-5 grid gap-x-8 gap-y-4 rounded-lg border p-6 text-sm sm:grid-cols-[max-content_1fr]">
	{#each view.fields as field (field.key)}
		<div class="contents">
			<dt class="font-medium">
				{field.label}
				{#if field.description}
					<p class="text-xs font-normal text-muted-foreground">{field.description}</p>
				{/if}
			</dt>
			<dd><FieldValue {field} value={record[field.key]} /></dd>
		</div>
	{/each}
</dl>

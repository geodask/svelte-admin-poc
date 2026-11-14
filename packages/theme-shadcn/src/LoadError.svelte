<!--
	What a View shows in its boundary's `failed` snippet when a read fails. A 404 (the record, or
	the Resource upstream, doesn't exist) says "not found" and links back to the list. Any other
	error shows its message, which the server has already made safe (an unexpected error never
	reaches the browser with its details), and a Retry button that resets the boundary, so the
	View loads again without a full page reload.
-->
<script lang="ts">
	import type { Resource } from '@svelte-admin/core';

	let {
		error,
		retry,
		resource,
		listViewHref,
		headingLevel = 2
	}: {
		/** What the boundary caught: Kit hands it over as `App.Error`, `{ status, message }`. */
		error: unknown;
		/**
		 * Load again: refresh the failed read, then reset the boundary so its content renders
		 * again. The button is disabled until it settles.
		 */
		retry: () => Promise<unknown>;
		resource: Resource;
		/** The href of the Resource's list View. */
		listViewHref: string;
		/** The heading's level: 1 when the View has no heading of its own above. */
		headingLevel?: 1 | 2;
	} = $props();

	const failure = $derived(describe(error));
	let retrying = $state(false);

	async function onRetry() {
		retrying = true;
		try {
			await retry();
		} finally {
			retrying = false;
		}
	}
	const records = $derived(resource.label.toLowerCase());

	function describe(caught: unknown): { status: number; message: string } {
		const { status, message } = (caught ?? {}) as { status?: unknown; message?: unknown };
		return {
			status: typeof status === 'number' ? status : 500,
			message: typeof message === 'string' && message ? message : 'An unexpected error occurred.'
		};
	}
</script>

<svelte:head>
	<title>{failure.status === 404 ? 'Not found' : 'Error'} · {resource.label}</title>
</svelte:head>

<div role="alert" class="flex flex-col items-start gap-3 rounded-lg border p-6 text-sm">
	{#if failure.status === 404}
		<svelte:element this={`h${headingLevel}`} class="text-lg font-semibold"
			>Not found</svelte:element
		>
		<p class="text-muted-foreground">
			This record doesn't exist in {resource.label}. It may have been deleted.
		</p>
		<a
			href={listViewHref}
			class="inline-flex h-8 items-center rounded-md border bg-background px-3 font-medium hover:bg-muted"
		>
			Back to {resource.label}
		</a>
	{:else}
		<svelte:element this={`h${headingLevel}`} class="text-lg font-semibold">
			Couldn't load {records}
		</svelte:element>
		<p class="text-muted-foreground">{failure.message}</p>
		<button
			type="button"
			onclick={onRetry}
			disabled={retrying}
			class="inline-flex h-8 items-center rounded-md bg-primary px-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
		>
			{retrying ? 'Retrying…' : 'Retry'}
		</button>
	{/if}
</div>

<!--
	What a View shows in its boundary's `failed` snippet when a read fails. A 404 says "not found"
	and links back to the list. Any other error shows its message, which the server has already
	made safe (an unexpected error never reaches the browser with its details), and a Retry button
	that loads again without a full page reload.

	`reasons` replace the "not found" sentence when the View already knows why, e.g. the edit
	View's "This record no longer exists" after a save of a record deleted meanwhile.
-->
<script lang="ts">
	import type { Resource } from '@svelte-admin/core';

	let {
		error,
		retry,
		resource,
		listViewHref,
		target,
		reasons = []
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
		/**
		 * What failed to load: one page of the list (under the list View's heading) or one record
		 * (with no heading of its own, so this one is the page's `h1`).
		 */
		target: 'list' | 'record';
		/** Why the record is missing, when the View knows: shown in place of "not found". */
		reasons?: readonly string[];
	} = $props();

	const failure = $derived(readFailure(error));
	const records = $derived(resource.label.toLowerCase());
	const heading = $derived(target === 'record' ? 'h1' : 'h2');
	let retrying = $state(false);

	async function onRetry() {
		retrying = true;
		try {
			await retry();
		} finally {
			retrying = false;
		}
	}

	/** The status and message of what was caught, with a 500 for anything else. */
	function readFailure(caught: unknown): { status: number; message: string } {
		const { status, message } = (caught ?? {}) as { status?: unknown; message?: unknown };
		return {
			status: typeof status === 'number' ? status : 500,
			message: typeof message === 'string' && message ? message : 'Something went wrong.'
		};
	}
</script>

<svelte:head>
	<title>{failure.status === 404 ? 'Not found' : 'Error'} · {resource.label}</title>
</svelte:head>

<div role="alert" class="flex flex-col items-start gap-3 rounded-lg border p-6 text-sm">
	{#if failure.status === 404}
		<svelte:element this={heading} class="text-lg font-semibold">Not found</svelte:element>
		<p class="text-muted-foreground">
			{#if reasons.length}
				{reasons.join(' ')}
			{:else if target === 'record'}
				This record doesn't exist in {resource.label}. It may have been deleted.
			{:else}
				The backend has no {records} to list.
			{/if}
		</p>
		{#if target === 'record'}
			<a
				href={listViewHref}
				class="inline-flex h-8 items-center rounded-md border bg-background px-3 font-medium hover:bg-muted"
			>
				Back to {resource.label}
			</a>
		{/if}
	{:else}
		<svelte:element this={heading} class="text-lg font-semibold">
			{target === 'record' ? "Couldn't load this record" : `Couldn't load ${records}`}
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

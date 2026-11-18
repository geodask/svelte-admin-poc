<!--
	"Export CSV" for a list View: it downloads every record that matches the list's search, sort
	and filters, on every page, as a CSV file. Export needs JavaScript (it is a remote command), so
	the button renders only after hydration, and a page without JavaScript never shows it. While
	the export runs it reads "Exporting…" and is disabled. An export that stopped at the cap says
	so beside the button ("Exported the first 50 of 60 records", or without the total when the
	backend can't count). A failed export downloads nothing: the reason shows beside the button,
	which becomes "Try again". It never leaves a rejection unhandled.
	A Theme part, exported for a replaced list View: give it the core's `createListView` helper.
	`Toolbar` composes it.
-->
<script module lang="ts">
	import type { ExportResult, ListViewState } from '@svelte-admin/core/views';

	export type ExportButtonProps = {
		/** The list View helper from the core's `createListView`. */
		view: ListViewState;
	};
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	let { view }: ExportButtonProps = $props();

	/** What `view.exportCsv` reports when it rejects anyway. */
	const FAILED = "Couldn't export the records.";

	// False on the server and until hydration, so a page without JavaScript shows no button.
	let interactive = $state(false);
	let exporting = $state(false);
	let result = $state<ExportResult>();
	onMount(() => {
		interactive = true;
	});

	/** The note beside the button after an export that stopped at the cap. */
	const capNote = $derived.by(() => {
		if (!result?.ok || !result.capped) return undefined;
		const records = result.rows === 1 ? 'record' : 'records';
		return result.total === undefined
			? `Exported the first ${result.rows} ${records}`
			: `Exported the first ${result.rows} of ${result.total} records`;
	});

	async function onExport() {
		exporting = true;
		result = undefined;
		try {
			result = await view.exportCsv();
		} catch {
			// `exportCsv` should report a failure, not reject; never leave a rejection unhandled.
			result = { ok: false, message: FAILED };
		} finally {
			exporting = false;
		}
	}
</script>

{#if interactive}
	<div class="flex items-center gap-2">
		<button
			type="button"
			disabled={exporting}
			aria-busy={exporting}
			onclick={onExport}
			class="inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
		>
			{exporting ? 'Exporting…' : result?.ok === false ? 'Try again' : 'Export CSV'}
		</button>
		{#if result?.ok === false}
			<p role="alert" class="text-sm text-destructive">{result.message}</p>
		{/if}
		<!-- Always in the page, so a screen reader announces the note as it appears. -->
		<p role="status" class="text-sm text-muted-foreground">{capNote ?? ''}</p>
	</div>
{/if}

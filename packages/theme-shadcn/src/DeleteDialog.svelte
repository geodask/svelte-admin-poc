<!--
	The confirmation before a delete: a modal dialog that names what it deletes, says the delete
	can't be undone, and offers Cancel and Delete. For one record it names it by its Record title
	("Delete Classic Margherita Pizza?"); for the selected rows of a list View it counts them
	("Delete 3 selected records from Recipes?"). While the delete runs, Delete shows progress and
	the dialog can't be closed. When it fails, the dialog stays open with the reason (and, for a
	bulk delete that stopped partway, how many records it deleted), and focus moves to Delete,
	which has become Try again. It never leaves a rejection unhandled.

	Deleting needs JavaScript (it is a remote command), so render the control that opens it only
	after hydration. A Theme part, exported for a replaced View: give it the Record title and a
	`confirm` that deletes, such as the core's `createDetailView(...).delete`, or a count, the
	Resource's label and `createListView(...).deleteSelected`.
-->
<script module lang="ts">
	import type { BulkDeleteResult, DeleteFailure, DeleteResult } from '@svelte-admin/core/views';

	export type DeleteDialogProps = {
		/** Whether the dialog is open. Bind it: the dialog closes itself on Cancel or Escape. */
		open: boolean;
		/**
		 * Delete. On success it is expected to move on (e.g. to the list View, or to clear the
		 * selection); on failure the dialog shows the message it reports, and for a bulk delete
		 * how many records were deleted before it stopped.
		 */
		confirm: () => Promise<DeleteResult | BulkDeleteResult>;
	} & (
		| {
				/** The Record title of the one record to delete, e.g. "Classic Margherita Pizza". */
				title: string;
				count?: undefined;
				label?: undefined;
		  }
		| {
				title?: undefined;
				/** How many selected records to delete, on every page. It may change after a failure. */
				count: number;
				/** The Resource's label, e.g. "Recipes". */
				label: string;
		  }
	);
</script>

<script lang="ts">
	import { tick } from 'svelte';

	let { open = $bindable(), title, count, label, confirm }: DeleteDialogProps = $props();

	let dialog: HTMLDialogElement;
	let confirmButton: HTMLButtonElement;
	let deleting = $state(false);
	/** Why the last attempt failed, and for a bulk delete how many of how many it deleted. */
	let failure = $state<DeleteFailure & { deleted?: number; attempted?: number }>();
	/** The words for what is deleted: one record by its Record title, or the selected rows. */
	const copy = $derived(
		count === undefined
			? {
					heading: `Delete ${title}?`,
					failed: "Couldn't delete this record.",
					maybeGone: 'It may already have been deleted.'
				}
			: {
					heading: `Delete ${count} selected ${count === 1 ? 'record' : 'records'} from ${label}?`,
					failed: "Couldn't delete the selected records.",
					maybeGone: 'One of them may already have been deleted.'
				}
	);
	const id = $props.id();

	// The dialog element follows `open`: modal while open, so the View behind can't be used. Each
	// opening starts afresh, without the failure of an earlier attempt.
	$effect(() => {
		if (open && !dialog.open) {
			failure = undefined;
			dialog.showModal();
		}
		if (!open && dialog.open) dialog.close();
	});

	/** What a bulk delete that stopped partway did, e.g. "1 of 3 records was deleted." */
	function partialCount(deleted: number, attempted: number): string {
		const records = attempted === 1 ? 'record' : 'records';
		const was = deleted === 1 ? 'was' : 'were';
		return `${deleted} of ${attempted} ${records} ${was} deleted. The rest are still selected.`;
	}

	async function onConfirm() {
		deleting = true;
		failure = undefined;
		const attempted = count;
		try {
			const result = await confirm();
			if (result.ok) open = false;
			else failure = { ...result, attempted };
		} catch {
			// `confirm` should report a failure, not reject; never leave a rejection unhandled.
			failure = { message: copy.failed };
		} finally {
			deleting = false;
		}
		if (failure) {
			// The focused button was disabled while deleting: give focus back to Try again.
			await tick();
			confirmButton.focus();
		}
	}
</script>

<!--
	Escape cancels, unless a delete is on its way. A browser may close the dialog anyway (Chrome
	ignores a cancelled Escape when it is repeated), so it is opened again until the delete ends.
-->
<dialog
	bind:this={dialog}
	aria-labelledby="{id}-heading"
	aria-describedby="{id}-warning"
	aria-busy={deleting}
	oncancel={(event) => {
		if (deleting) event.preventDefault();
	}}
	onclose={() => {
		if (deleting) dialog.showModal();
		else open = false;
	}}
	class="m-auto w-full max-w-md rounded-lg border bg-background p-6 text-sm text-foreground shadow-lg backdrop:bg-black/50"
>
	<h2 id="{id}-heading" class="text-lg font-semibold">{copy.heading}</h2>
	<p id="{id}-warning" class="mt-2 text-muted-foreground">This can't be undone.</p>

	{#if failure}
		<div role="alert" class="mt-4 rounded-md border border-destructive/50 p-3 text-destructive">
			<p>{failure.message}</p>
			{#if failure.status === 404}
				<p class="mt-1">{copy.maybeGone}</p>
			{/if}
			{#if failure.deleted && failure.attempted !== undefined}
				<p class="mt-1">{partialCount(failure.deleted, failure.attempted)}</p>
			{/if}
		</div>
	{/if}

	<div class="mt-6 flex justify-end gap-2">
		<button
			type="button"
			disabled={deleting}
			onclick={() => (open = false)}
			class="inline-flex h-9 items-center rounded-md border bg-background px-4 font-medium hover:bg-muted disabled:opacity-50"
		>
			Cancel
		</button>
		<button
			bind:this={confirmButton}
			type="button"
			disabled={deleting}
			onclick={onConfirm}
			class="inline-flex h-9 items-center rounded-md bg-destructive px-4 font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
		>
			{deleting ? 'Deleting…' : failure ? 'Try again' : 'Delete'}
		</button>
	</div>
</dialog>

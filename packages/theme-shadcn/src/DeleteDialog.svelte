<!--
	The confirmation before a delete: a modal dialog that names the record by its Record title,
	says the delete can't be undone, and offers Cancel and Delete. While the delete runs, Delete
	shows progress and the dialog can't be closed. When it fails, the dialog stays open with the
	reason, focus moves to Delete, which has become Try again. It never leaves a rejection
	unhandled.

	Deleting needs JavaScript (it is a remote command), so render the control that opens it only
	after hydration. A Theme part, exported for a replaced View: give it the Record title and a
	`confirm` that deletes, such as the core's `createDetailView(...).delete`.
-->
<script module lang="ts">
	import type { DeleteFailure, DeleteResult } from '@svelte-admin/core/views';

	export type DeleteDialogProps = {
		/** Whether the dialog is open. Bind it: the dialog closes itself on Cancel or Escape. */
		open: boolean;
		/** The Record title of the record to delete, e.g. "Classic Margherita Pizza". */
		title: string;
		/**
		 * Delete the record. On success it is expected to move on (e.g. to the list View); on
		 * failure the dialog shows the message it reports.
		 */
		confirm: () => Promise<DeleteResult>;
	};
</script>

<script lang="ts">
	import { tick } from 'svelte';

	let { open = $bindable(), title, confirm }: DeleteDialogProps = $props();

	let dialog: HTMLDialogElement;
	let confirmButton: HTMLButtonElement;
	let deleting = $state(false);
	let failure = $state<DeleteFailure>();
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

	async function onConfirm() {
		deleting = true;
		failure = undefined;
		try {
			const result = await confirm();
			if (result.ok) open = false;
			else failure = result;
		} catch {
			// `confirm` should report a failure, not reject; never leave a rejection unhandled.
			failure = { message: "Couldn't delete this record." };
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
	<h2 id="{id}-heading" class="text-lg font-semibold">Delete {title}?</h2>
	<p id="{id}-warning" class="mt-2 text-muted-foreground">This can't be undone.</p>

	{#if failure}
		<div role="alert" class="mt-4 rounded-md border border-destructive/50 p-3 text-destructive">
			<p>{failure.message}</p>
			{#if failure.status === 404}
				<p class="mt-1">It may already have been deleted.</p>
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

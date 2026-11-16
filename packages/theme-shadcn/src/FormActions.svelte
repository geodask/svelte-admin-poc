<!--
	The foot of a create or edit form: Save, which submits it, and Cancel, a link that leaves it.
	While a save is in flight, Save shows progress and is disabled, so it can't be sent twice.

	A Theme part, exported for a replaced create or edit View: give it the core's
	`createFormView(...).saving` and `.cancelHref`. Render it inside the `<form>`.
-->
<script module lang="ts">
	export type FormActionsProps = {
		/** Whether a save is in flight, e.g. `createFormView(...).saving`. */
		saving: boolean;
		/** Where Cancel leads, e.g. `createFormView(...).cancelHref`. */
		cancelHref: string;
	};
</script>

<script lang="ts">
	let { saving, cancelHref }: FormActionsProps = $props();
</script>

<div class="flex items-center gap-2">
	<button
		type="submit"
		disabled={saving}
		class="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
	>
		{saving ? 'Saving…' : 'Save'}
	</button>
	<a
		href={cancelHref}
		class="inline-flex h-9 items-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-muted"
	>
		Cancel
	</a>
</div>

<!--
	A checkbox that selects a row of a list View, or every row on the page (with a mixed state
	when only some are). It is a native checkbox styled with the app's tokens, so it renders on
	the server like the rest of the list. Selection needs JavaScript, so until the page is
	hydrated the checkbox is disabled: without JavaScript it shows but can't be ticked to no
	effect. A Theme part, exported for a replaced list View: wire it to the selection of the
	core's `createListView` helper, e.g. `checked={view.selection.has(id)}` and
	`onchange={(checked) => view.selection.toggle(id, checked)}`.
-->
<script module lang="ts">
	export type SelectionCheckboxProps = {
		checked: boolean;
		/** The mixed state: some of the rows it stands for are selected, but not all. */
		indeterminate?: boolean;
		/** The checkbox's accessible name, e.g. "Select Classic Margherita Pizza". */
		label: string;
		disabled?: boolean;
		/** Called with the checkbox's new state when a person ticks or clears it. */
		onchange: (checked: boolean) => void;
	};
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	let {
		checked,
		indeterminate = false,
		label,
		disabled = false,
		onchange
	}: SelectionCheckboxProps = $props();

	// False on the server and until hydration, so the checkbox can't be ticked without JavaScript.
	let interactive = $state(false);
	onMount(() => {
		interactive = true;
	});
</script>

<input
	type="checkbox"
	aria-label={label}
	{checked}
	disabled={disabled || !interactive}
	{@attach (input) => {
		input.indeterminate = indeterminate;
	}}
	onchange={(event) => onchange(event.currentTarget.checked)}
	class="block size-4 shrink-0 cursor-pointer rounded-[4px] accent-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
/>

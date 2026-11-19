<!--
	The Theme's `image` Kind on the create and edit Views: the Theme's URL input, with the Field's
	label, help text and issues. Whatever it holds is saved as typed; the Views only load it as an
	image when the core's `imageSrc` rule allows it. A Field that isn't text gets its built-in
	input.
-->
<script lang="ts">
	import type { FormInputSpec, KindInputProps } from '@svelte-admin/core';
	import FieldInput from '../FieldInput.svelte';
	import { withoutNamedKind } from '../kinds.ts';

	let { spec, field }: KindInputProps = $props();

	const url = $derived.by((): FormInputSpec =>
		spec.kind === 'text' ? { ...withoutNamedKind(spec), format: 'url' } : withoutNamedKind(spec)
	);
</script>

<FieldInput spec={url} {field} />

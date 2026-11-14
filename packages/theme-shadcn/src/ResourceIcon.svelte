<!--
	A Resource's icon. The Resource holds it as a lazy import, so it is awaited here: the server
	renders it in place, with no pending state.
-->
<script lang="ts">
	import type { ResourceIcon } from '@svelte-admin/core';

	let { icon }: { icon: ResourceIcon } = $props();

	const Icon = $derived((await icon()).default);
</script>

<Icon class="size-4 shrink-0" />

<script lang="ts">
	import { CreateView } from '@svelte-admin/theme-shadcn';
	import { admin } from '#lib/admin.ts';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();

	const entry = $derived(admin.resources[params.resource]);
	const remote = $derived(await entry.remote());
</script>

<CreateView resource={entry.resource} {remote} />

<script lang="ts">
	import { DetailView } from '@svelte-admin/theme-shadcn';
	import { admin } from '#lib/admin.ts';
	import type { PageProps } from './$types';

	let { params, data }: PageProps = $props();

	const entry = $derived(admin.resources[params.resource]);
	const remote = $derived(await entry.remote());
</script>

<DetailView {admin} resource={entry.resource} {remote} id={data.id} />

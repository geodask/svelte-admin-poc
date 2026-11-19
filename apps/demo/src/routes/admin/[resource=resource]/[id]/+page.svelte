<script lang="ts">
	import { DetailView } from '@svelte-admin/theme-shadcn';
	import { admin } from '#lib/admin.ts';
	import type { PageProps } from './$types';

	let { params, data }: PageProps = $props();

	const { resource, remote } = $derived(await admin.entry(params.resource));
</script>

<DetailView {admin} {resource} {remote} id={data.id} />

<!--
	The breadcrumb's last crumb on a detail View: the record's Record title. It reads the record
	through the same remote query as the detail View, so both share one request. A failed read is
	the detail View's to report; the crumb only says "Not found" or "Error", and shows the title
	once a Retry loads the record.
-->
<script lang="ts">
	import { recordTitle, type ResourceRemote } from '@svelte-admin/core';
	import type { ShellLocation } from '@svelte-admin/core/views';
	import * as Breadcrumb from './components/ui/breadcrumb/index.ts';

	let { here, id }: { here: ShellLocation; id: string | number } = $props();

	const remote: ResourceRemote = $derived(await here.remote());
	const title = $derived(
		await remote.getOne(id).then(
			(record) => recordTitle(here.resource, record),
			(error: { status?: number } | undefined) => (error?.status === 404 ? 'Not found' : 'Error')
		)
	);
</script>

<Breadcrumb.Page>{title}</Breadcrumb.Page>

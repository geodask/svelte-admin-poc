<script lang="ts">
	import { getResourceContext } from '$lib/resource/components/resource-provider.svelte';

	interface Props {
		params: {
			resource: string;
			id: string;
		};
	}

	const { params }: Props = $props();
	const ctx = getResourceContext();

	const getOne = $derived(ctx.resource.remotes.getOne(params.id));
	const detail = $derived(await getOne);

	$effect.pre(() => {
		ctx.queries.getOne = getOne;
	});
</script>

<pre><code>{JSON.stringify(detail.data, null, 2)}</code></pre>
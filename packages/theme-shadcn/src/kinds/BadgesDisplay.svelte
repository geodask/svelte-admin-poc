<!--
	The Theme's `badges` Kind on the detail View: every item as a badge. FieldValue renders it for
	a list of text or enum values only.
-->
<script lang="ts">
	import type { KindDisplayProps } from '@svelte-admin/core';
	import { isBadgeList } from '../kinds.ts';
	import Badges from './Badges.svelte';

	let { value }: Pick<KindDisplayProps, 'value'> = $props();
</script>

<Badges items={isBadgeList(value) ? value : []} class="flex-wrap" />

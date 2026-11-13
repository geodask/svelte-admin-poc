<!-- Primitive-level seam: the CORE decides how each Field kind looks (enum → Badge, list → Badges).
     A Theme can only restyle Badge, unless the contract grows per-kind cell overrides. -->
<script lang="ts">
	import type { Column } from '../columns.ts';
	import type { ListView } from '../list-view.svelte.ts';
	import { primitives } from './primitives';
	let { col, value, list }: { col: Column; value: unknown; list: ListView } = $props();
	const P = primitives();
</script>

{#if value === undefined || value === null}<P.Muted>—</P.Muted>
{:else if col.kind === 'enum'}<P.Badge>{value}</P.Badge>
{:else if col.kind === 'boolean'}<P.Badge tone={value ? 'positive' : 'muted'}>{value ? 'Yes' : 'No'}</P.Badge>
{:else if col.kind === 'list'}{#each value as string[] as t}<P.Badge tone="muted">{t}</P.Badge>{' '}{/each}
{:else}{list.format(col, value)}{/if}

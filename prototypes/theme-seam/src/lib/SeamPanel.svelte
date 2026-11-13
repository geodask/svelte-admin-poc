<!-- PROTOTYPE (PER-18): shows who writes what under the current variant, with line counts and source. -->
<script lang="ts">
	import { page } from '$app/state';
	import { variantOf } from './variants';

	const src = import.meta.glob(['/src/lib/core/**/*', '/src/lib/themes/**/*', '/src/routes/recipes/gallery/*.svelte'], {
		query: '?raw', import: 'default', eager: true
	}) as Record<string, string>;

	const v = $derived(variantOf(page.url));
	const files = (prefix: string, exclude?: string) =>
		Object.entries(src)
			.filter(([p]) => p.startsWith(prefix) && (!exclude || !p.startsWith(exclude)))
			.map(([p, code]) => ({ path: p.replace('/src/lib/', '').replace('/src/routes/', 'routes/'), code, lines: code.trimEnd().split('\n').length }));
	const sum = (fs: { lines: number }[]) => fs.reduce((n, f) => n + f.lines, 0);

	const groups = $derived([
		{ title: 'Theme author writes', note: v.seam === 'view' ? 'The four Views, their parts and the Field display. Free to change layout.' : 'One component per contract entry. Layout is fixed by the core.', files: files(`/src/lib/themes/${v.theme}/`) },
		{ title: 'Core ships (headless logic)', note: 'Shared by both seams.', files: files('/src/lib/core/', '/src/lib/core/primitive-level/') },
		...(v.seam === 'primitive' ? [{ title: 'Core ships (View markup + contract)', note: 'Only under the Primitive-level seam.', files: files('/src/lib/core/primitive-level/') }] : []),
		{ title: 'App writes to replace the list View', note: 'See "Replaced View" in the header.', files: files(`/src/routes/recipes/gallery/Gallery${v.seam === 'view' ? (v.key === 'A1' ? 'ViewLevel' : 'ViewLevelNoParts') : 'PrimitiveLevel'}.svelte`) }
	]);
</script>

<section class="mx-auto mt-10 mb-20 max-w-6xl rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 font-mono text-xs text-neutral-700">
	<h2 class="mb-3 font-sans text-sm font-semibold">Seam panel: {v.key}, {v.name}</h2>
	<div class="grid gap-4 md:grid-cols-2">
		{#each groups as g}
			<div>
				<h3 class="font-sans font-semibold">{g.title}: {g.files.length} files, {sum(g.files)} lines</h3>
				<p class="mb-1 font-sans text-neutral-500">{g.note}</p>
				{#each g.files as f}
					<details>
						<summary class="cursor-pointer">{f.path} <span class="text-neutral-400">({f.lines})</span></summary>
						<pre class="my-1 max-h-80 overflow-auto rounded bg-white p-2">{f.code}</pre>
					</details>
				{/each}
			</div>
		{/each}
	</div>
</section>

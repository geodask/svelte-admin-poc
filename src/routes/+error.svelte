<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { ArrowLeftIcon, HouseIcon } from '@lucide/svelte';

	const { status, error, url } = $derived(page);
	const path = $derived(url.pathname);
	const firstSegment = $derived(path.split('/').filter(Boolean)[0]);

	const errorMessages: Record<number, { title: string; description: string }> = {
		404: {
			title: 'Page not found',
			description: 'The page you are looking for does not exist or has been moved.'
		},
		500: {
			title: 'Server error',
			description: 'Something went wrong on our end. Please try again later.'
		},
		403: {
			title: 'Access denied',
			description: "You don't have permission to access this resource."
		}
	};

	const info = $derived(
		errorMessages[status] ?? {
			title: `Error ${status}`,
			description: error?.message ?? 'An unexpected error occurred.'
		}
	);
</script>

<div class="flex min-h-[80vh] flex-col items-center justify-center px-4">
	<!-- Large status code display -->
	<div class="relative mb-8 select-none">
		<span
			class="text-[10rem] leading-none font-black tracking-tighter text-foreground/5 sm:text-[14rem]"
		>
			{status}
		</span>
	</div>

	<!-- Error info -->
	<div class="flex max-w-md flex-col items-center text-center">
		<h1 class="text-2xl font-semibold tracking-tight text-foreground">
			{info.title}
		</h1>

		{#if status === 404 && firstSegment}
			<p class="mt-2 text-sm text-muted-foreground">
				No route or resource found at
				<code
					class="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground"
				>
					/{firstSegment}
				</code>
			</p>
		{:else}
			<p class="mt-2 text-sm text-muted-foreground">
				{info.description}
			</p>
		{/if}

		<Separator class="my-6 w-16" />

		<!-- CTAs -->
		<div class="flex items-center gap-3">
			<a href={resolve('/')}>
				<Button variant="default" size="sm">
					<HouseIcon />
					Dashboard
				</Button>
			</a>
			<Button variant="outline" size="sm" onclick={() => history.back()}>
				<ArrowLeftIcon />
				Go back
			</Button>
		</div>

		<!-- Subtle path breadcrumb -->
		<p class="mt-8 font-mono text-xs text-muted-foreground/60">
			{path}
		</p>
	</div>
</div>

import { onNavigate } from '$app/navigation';
import { page } from '$app/state';
import { onMount } from 'svelte';
import type { Admin, SidebarItem } from './admin.ts';

/** Where the current page is in the admin, for any admin: what `admin.locate` finds. */
export type ShellLocation = NonNullable<ReturnType<Admin['locate']>>;

/** What the shell needs from `admin.ts`: the part of the admin `defineAdmin` returns it reads. */
export type ShellAdmin = Pick<Admin, 'basePath' | 'homeHref' | 'sidebar' | 'locate'>;

/** A sidebar link, marked active when the current page is on its Resource. */
export type ShellItem = SidebarItem & { active: boolean };

/**
 * The headless admin shell: the sidebar's groups, with the current Resource's link marked
 * active, and where the current page is, for the breadcrumb. A link is active on its
 * Resource's list View and anywhere under it, so a detail View keeps its Resource highlighted.
 * Every href comes from the base path in `admin.ts`. The Theme's shell is built on it.
 *
 * @example
 * const shell = createShell(admin);
 * // shell.groups, shell.here?.resource.label, shell.here?.id
 */
export function createShell(admin: ShellAdmin) {
	// A workaround: Kit's router (3.2) starts a client-side navigation while Svelte is still
	// rendering async work, and that breaks the render: the URL changes but the list doesn't, Kit's
	// root throws "Cannot read properties of undefined (reading 'component')", or the page freezes.
	// It happens when a link is clicked in one of two gaps, so the shell closes both. Drop this once
	// Kit waits for the render before it starts the next navigation.
	//
	// 1. Hydration: Kit handles clicks as soon as its router starts, before the page's async
	// hydration (the awaits of a View and its cells) has finished. Until then the shell asks Kit
	// to follow its links with a full page load, as without JavaScript. `onMount` runs only once
	// the whole hydrated tree has rendered, the shell's own included, so it marks the end of
	// hydration.
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});

	// 2. Another navigation: Kit applies a navigation as soon as its data has loaded, even while
	// the previous one still renders (its list still loading), as after two quick clicks. So each
	// navigation waits, before it is applied, for the one before it to complete: Kit completes a
	// navigation once its render has settled, or drops it once a newer one has replaced it. Kit
	// awaits what an `onNavigate` callback returns.
	let previous: Promise<void> | undefined;
	onNavigate(({ complete }) => {
		const waitFor = previous;
		const done = complete.then(
			() => {},
			() => {}
		);
		previous = done;
		void done.then(() => {
			if (previous === done) previous = undefined;
		});
		return waitFor;
	});

	const here = $derived(admin.locate(page.url.pathname));
	const groups = $derived(
		admin.sidebar.map((group) => ({
			label: group.label,
			items: group.items.map((item): ShellItem => ({ ...item, active: item.name === here?.name }))
		}))
	);

	return {
		/** Where the brand links to: the admin's index target, the first Resource's list. */
		homeHref: admin.homeHref ?? admin.basePath,
		/** The sidebar's groups, in order, each link marked active or not. */
		get groups() {
			return groups;
		},
		/**
		 * The Resource the current page is on, its list href and, on a detail View, the record's
		 * typed id. `undefined` outside the admin's Resources.
		 */
		get here(): ShellLocation | undefined {
			return here;
		},
		/**
		 * Kit's link options for the element that holds the whole admin, to spread on it:
		 * `data-sveltekit-reload` until the page has hydrated, so a link clicked before then loads
		 * the page in full, and none after.
		 */
		get linkOptions(): { 'data-sveltekit-reload'?: '' } {
			return hydrated ? {} : { 'data-sveltekit-reload': '' };
		}
	};
}

/** What `createShell` returns. */
export type ShellState = ReturnType<typeof createShell>;

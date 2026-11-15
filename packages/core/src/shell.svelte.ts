import { page } from '$app/state';
import type { AdminEntry, AdminLocation, SidebarGroup, SidebarItem } from './admin.ts';

/** Where the current page is in the admin, for any admin: what `admin.locate` finds. */
export type ShellLocation = AdminLocation<Record<string, AdminEntry>>;

/** What the shell needs from `admin.ts`: the admin `defineAdmin` returns. */
export type ShellAdmin = {
	basePath: string;
	homeHref: string | undefined;
	sidebar: readonly SidebarGroup[];
	locate(pathname: string): ShellLocation | undefined;
};

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
		}
	};
}

/** What `createShell` returns. */
export type ShellState = ReturnType<typeof createShell>;

// The demo's own Kinds, declared to the core so a Field may name them with `kind` (and a typo is a
// type error). Their components are registered in admin.ts.
declare module '@svelte-admin/core' {
	interface Kinds {
		/**
		 * A whole number from 1 to 5, shown as stars and set with a radio group, which sends the
		 * chosen rating as text (or nothing for "None").
		 */
		stars: { input: string };
	}
}

export {};

import type { KindRegistry } from '@svelte-admin/core';

/**
 * The Theme's own Kinds, by name. A Field that names one of them is rendered with its components,
 * slot by slot, unless the app's Kind of the same name gives that slot. None yet.
 */
export const themeKinds: KindRegistry = {};
